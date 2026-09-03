"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  activities,
  activityTags,
  tags,
  events,
  tasks,
  documents,
  submissions,
  submissionVersions,
  evaluationCriteria,
  aiReviews,
  aiReviewItems,
  notes,
  notifications,
  activityHistory,
} from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logHistory } from "@/lib/history";
import { deleteStoredFile } from "@/lib/storage";
import { newId } from "@/lib/utils";
import { activitySchema, portfolioSchema, type ActivityInput, type PortfolioInput } from "@/lib/validators";
import {
  ACTIVITY_COLORS,
  ACTIVITY_STATUSES,
  type ActivityStatus,
} from "@/lib/constants";
import { runDeadlineNotifications } from "@/services/notification/generator";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/** 소유권 확인 후 활동 반환 (없으면 null) */
async function getOwnedActivity(activityId: string, userId: string) {
  return (await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .limit(1))[0];
}

async function syncTags(userId: string, activityId: string, tagsText: string | null) {
  await db.delete(activityTags).where(eq(activityTags.activityId, activityId));
  if (!tagsText) return;

  const names = Array.from(
    new Set(
      tagsText
        .split(/[,#\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 15),
    ),
  );
  for (const name of names) {
    let tag = (await db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, name)))
      .limit(1))[0];
    if (!tag) {
      tag = { id: newId(), userId, name };
      await db.insert(tags).values(tag);
    }
    await db.insert(activityTags).values({ activityId, tagId: tag.id });
  }
}

export async function createActivity(input: ActivityInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const count = (
    await db
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.userId, user.id))

  ).length;

  const id = newId();
  const now = Date.now();
  await db.insert(activities)
    .values({
      id,
      userId: user.id,
      name: data.name,
      organizer: data.organizer,
      type: data.type,
      status: data.status,
      importance: data.importance,
      color: data.color ?? ACTIVITY_COLORS[count % ACTIVITY_COLORS.length],
      startDate: data.startDate,
      endDate: data.endDate,
      applyDeadline: data.applyDeadline,
      submitDeadline: data.submitDeadline,
      announceDate: data.announceDate,
      link: data.link,
      contact: data.contact,
      memo: data.memo,
      createdAt: now,
      updatedAt: now,
    });

  await syncTags(user.id, id, data.tagsText);
  await autoCreateDeadlineEvents(user.id, id, data);
  await logHistory(user.id, id, "created", `활동 "${data.name}" 생성`);

  // 마감이 바뀌었으니 알림을 지금 다시 계산한다 (화면 이동 때마다 돌리지 않기 위해).
  await runDeadlineNotifications(user.id);
  revalidatePath("/activities");
  revalidatePath("/");
  return { ok: true, id };
}

/** 활동의 마감일 필드들로 캘린더 일정 자동 생성 */
async function autoCreateDeadlineEvents(
  userId: string,
  activityId: string,
  data: { name: string; applyDeadline: string | null; submitDeadline: string | null; announceDate: string | null },
) {
  const pairs: Array<[string | null, string, string]> = [
    [data.applyDeadline, "apply_deadline", "지원 마감"],
    [data.submitDeadline, "final_submit", "최종 제출"],
    [data.announceDate, "result", "결과 발표"],
  ];
  for (const [date, type, label] of pairs) {
    if (!date) continue;
    const exists = (await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(eq(events.activityId, activityId), eq(events.type, type), eq(events.date, date)),
      )
      .limit(1))[0];
    if (exists) continue;
    await db.insert(events)
      .values({
        id: newId(),
        userId,
        activityId,
        title: `${data.name} ${label}`,
        type,
        date,
        createdAt: Date.now(),
      });
  }
}

export async function updateActivity(activityId: string, input: ActivityInput): Promise<ActionResult> {
  const user = await requireUser();
  const activity = await getOwnedActivity(activityId, user.id);
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  await db.update(activities)
    .set({
      name: data.name,
      organizer: data.organizer,
      type: data.type,
      status: data.status,
      importance: data.importance,
      color: data.color ?? activity.color,
      startDate: data.startDate,
      endDate: data.endDate,
      applyDeadline: data.applyDeadline,
      submitDeadline: data.submitDeadline,
      announceDate: data.announceDate,
      link: data.link,
      contact: data.contact,
      memo: data.memo,
      updatedAt: Date.now(),
    })
    .where(eq(activities.id, activityId));

  await syncTags(user.id, activityId, data.tagsText);
  await autoCreateDeadlineEvents(user.id, activityId, data);

  if (activity.status !== data.status) {
    await logHistory(
      user.id,
      activityId,
      "status",
      `상태 변경: ${ACTIVITY_STATUSES[activity.status as ActivityStatus] ?? activity.status} → ${ACTIVITY_STATUSES[data.status as ActivityStatus] ?? data.status}`,
    );
  } else {
    await logHistory(user.id, activityId, "updated", "활동 정보 수정");
  }

  // 마감이 바뀌었으니 알림을 지금 다시 계산한다 (화면 이동 때마다 돌리지 않기 위해).
  await runDeadlineNotifications(user.id);
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/");
  return { ok: true, id: activityId };
}

export async function updateActivityStatus(activityId: string, status: string): Promise<ActionResult> {
  const user = await requireUser();
  const activity = await getOwnedActivity(activityId, user.id);
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };
  if (!(status in ACTIVITY_STATUSES)) return { ok: false, error: "잘못된 상태입니다." };
  if (activity.status === status) return { ok: true };

  await db.update(activities)
    .set({ status, updatedAt: Date.now() })
    .where(eq(activities.id, activityId));

  await logHistory(
    user.id,
    activityId,
    "status",
    `상태 변경: ${ACTIVITY_STATUSES[activity.status as ActivityStatus]} → ${ACTIVITY_STATUSES[status as ActivityStatus]}`,
  );

  // 마감이 바뀌었으니 알림을 지금 다시 계산한다 (화면 이동 때마다 돌리지 않기 위해).
  await runDeadlineNotifications(user.id);
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updatePortfolio(activityId: string, input: PortfolioInput): Promise<ActionResult> {
  const user = await requireUser();
  const activity = await getOwnedActivity(activityId, user.id);
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const parsed = portfolioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  await db.update(activities)
    .set({
      role: data.role,
      achievement: data.achievement,
      learned: data.learned,
      skills: data.skills,
      updatedAt: Date.now(),
    })
    .where(eq(activities.id, activityId));

  await logHistory(user.id, activityId, "updated", "활동 기록(포트폴리오) 수정");
  revalidatePath(`/activities/${activityId}`);
  return { ok: true };
}

/**
 * 활동 복제.
 * 매년 열리는 공모전·반복되는 서포터즈는 구조가 같으므로,
 * 뼈대(일정·작업·평가 기준·태그·메모)만 복사하고
 * 결과물(문서·제출물·AI 리뷰·기록)은 가져오지 않는다.
 */
export async function duplicateActivity(activityId: string): Promise<ActionResult> {
  const user = await requireUser();
  const source = await getOwnedActivity(activityId, user.id);
  if (!source) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const now = Date.now();
  const newActivityId = newId();

  await db.insert(activities).values({
    ...source,
    id: newActivityId,
    name: `${source.name} (복사본)`.slice(0, 200),
    status: "interested",
    aiSummary: null,
    // 포트폴리오 기록(성과·배운 점)은 그 회차의 결과이므로 복사하지 않는다
    achievement: null,
    learned: null,
    createdAt: now,
    updatedAt: now,
  });

  // 일정: 날짜 그대로 복사 (새 회차 날짜는 사용자가 조정)
  const srcEvents = await db
    .select()
    .from(events)
    .where(and(eq(events.activityId, activityId), eq(events.userId, user.id)));
  for (const evt of srcEvents) {
    await db.insert(events).values({ ...evt, id: newId(), activityId: newActivityId, createdAt: now });
  }

  // 작업: 진행 상태는 초기화해서 다시 할 일로 되돌린다
  const srcTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.activityId, activityId), eq(tasks.userId, user.id)));
  for (const task of srcTasks) {
    await db.insert(tasks).values({
      ...task,
      id: newId(),
      activityId: newActivityId,
      status: "todo",
      sourceReviewId: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
  }

  // 평가 기준
  const srcCriteria = await db
    .select()
    .from(evaluationCriteria)
    .where(and(eq(evaluationCriteria.activityId, activityId), eq(evaluationCriteria.userId, user.id)));
  for (const c of srcCriteria) {
    await db.insert(evaluationCriteria).values({ ...c, id: newId(), activityId: newActivityId });
  }

  // 태그 연결
  const srcTags = await db
    .select()
    .from(activityTags)
    .where(eq(activityTags.activityId, activityId));
  for (const link of srcTags) {
    await db.insert(activityTags).values({ activityId: newActivityId, tagId: link.tagId });
  }

  await logHistory(
    user.id,
    newActivityId,
    "created",
    `활동 복제로 생성: ${source.name}`,
  );

  // 마감이 바뀌었으니 알림을 지금 다시 계산한다 (화면 이동 때마다 돌리지 않기 위해).
  await runDeadlineNotifications(user.id);
  revalidatePath("/activities");
  return { ok: true, id: newActivityId };
}

export async function deleteActivity(activityId: string): Promise<void> {
  const user = await requireUser();
  const activity = await getOwnedActivity(activityId, user.id);
  if (!activity) redirect("/activities");

  // 저장된 파일 실제 삭제
  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.activityId, activityId), eq(documents.userId, user.id)));
  for (const doc of docs) await deleteStoredFile(doc.storagePath);

  const subIds = (
    await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.activityId, activityId))

  ).map((s) => s.id);
  const reviewIds = (
    await db
      .select({ id: aiReviews.id })
      .from(aiReviews)
      .where(eq(aiReviews.activityId, activityId))

  ).map((r) => r.id);

  await db.delete(activityTags).where(eq(activityTags.activityId, activityId));
  await db.delete(events).where(eq(events.activityId, activityId));
  await db.delete(tasks).where(eq(tasks.activityId, activityId));
  await db.delete(documents).where(eq(documents.activityId, activityId));
  if (subIds.length > 0) {
    await db.delete(submissionVersions).where(inArray(submissionVersions.submissionId, subIds));
  }
  await db.delete(submissions).where(eq(submissions.activityId, activityId));
  await db.delete(evaluationCriteria).where(eq(evaluationCriteria.activityId, activityId));
  if (reviewIds.length > 0) {
    await db.delete(aiReviewItems).where(inArray(aiReviewItems.reviewId, reviewIds));
  }
  await db.delete(aiReviews).where(eq(aiReviews.activityId, activityId));
  await db.delete(notes).where(eq(notes.activityId, activityId));
  await db.delete(notifications).where(eq(notifications.activityId, activityId));
  await db.delete(activityHistory).where(eq(activityHistory.activityId, activityId));
  await db.delete(activities).where(eq(activities.id, activityId));

  revalidatePath("/activities");
  revalidatePath("/");
  redirect("/activities");
}
