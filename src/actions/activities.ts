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

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/** 소유권 확인 후 활동 반환 (없으면 null) */
async function getOwnedActivity(activityId: string, userId: string) {
  return await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .get();
}

async function syncTags(userId: string, activityId: string, tagsText: string | null) {
  await db.delete(activityTags).where(eq(activityTags.activityId, activityId)).run();
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
    let tag = await db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, name)))
      .get();
    if (!tag) {
      tag = { id: newId(), userId, name };
      await db.insert(tags).values(tag).run();
    }
    await db.insert(activityTags).values({ activityId, tagId: tag.id }).run();
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
      .all()
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
    })
    .run();

  await syncTags(user.id, id, data.tagsText);
  await autoCreateDeadlineEvents(user.id, id, data);
  await logHistory(user.id, id, "created", `활동 "${data.name}" 생성`);

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
    const exists = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(eq(events.activityId, activityId), eq(events.type, type), eq(events.date, date)),
      )
      .get();
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
      })
      .run();
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
    .where(eq(activities.id, activityId))
    .run();

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
    .where(eq(activities.id, activityId))
    .run();

  await logHistory(
    user.id,
    activityId,
    "status",
    `상태 변경: ${ACTIVITY_STATUSES[activity.status as ActivityStatus]} → ${ACTIVITY_STATUSES[status as ActivityStatus]}`,
  );

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
    .where(eq(activities.id, activityId))
    .run();

  await logHistory(user.id, activityId, "updated", "활동 기록(포트폴리오) 수정");
  revalidatePath(`/activities/${activityId}`);
  return { ok: true };
}

export async function deleteActivity(activityId: string): Promise<void> {
  const user = await requireUser();
  const activity = await getOwnedActivity(activityId, user.id);
  if (!activity) redirect("/activities");

  // 저장된 파일 실제 삭제
  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.activityId, activityId), eq(documents.userId, user.id)))
    .all();
  for (const doc of docs) await deleteStoredFile(doc.storagePath);

  const subIds = (
    await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.activityId, activityId))
      .all()
  ).map((s) => s.id);
  const reviewIds = (
    await db
      .select({ id: aiReviews.id })
      .from(aiReviews)
      .where(eq(aiReviews.activityId, activityId))
      .all()
  ).map((r) => r.id);

  await db.delete(activityTags).where(eq(activityTags.activityId, activityId)).run();
  await db.delete(events).where(eq(events.activityId, activityId)).run();
  await db.delete(tasks).where(eq(tasks.activityId, activityId)).run();
  await db.delete(documents).where(eq(documents.activityId, activityId)).run();
  if (subIds.length > 0) {
    await db.delete(submissionVersions).where(inArray(submissionVersions.submissionId, subIds)).run();
  }
  await db.delete(submissions).where(eq(submissions.activityId, activityId)).run();
  await db.delete(evaluationCriteria).where(eq(evaluationCriteria.activityId, activityId)).run();
  if (reviewIds.length > 0) {
    await db.delete(aiReviewItems).where(inArray(aiReviewItems.reviewId, reviewIds)).run();
  }
  await db.delete(aiReviews).where(eq(aiReviews.activityId, activityId)).run();
  await db.delete(notes).where(eq(notes.activityId, activityId)).run();
  await db.delete(notifications).where(eq(notifications.activityId, activityId)).run();
  await db.delete(activityHistory).where(eq(activityHistory.activityId, activityId)).run();
  await db.delete(activities).where(eq(activities.id, activityId)).run();

  revalidatePath("/activities");
  revalidatePath("/");
  redirect("/activities");
}
