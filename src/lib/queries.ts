import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  activities,
  activityTags,
  tags,
  tasks,
  aiReviews,
  submissionVersions,
  documents,
  type ActivityRow,
} from "@/lib/db";
import { daysUntil } from "@/lib/utils";
import { FINISHED_STATUSES, type ActivityStatus } from "@/lib/constants";

export interface ActivityMeta extends ActivityRow {
  tagNames: string[];
  taskTotal: number;
  taskDone: number;
  /** 최근 제출물 평가 AI 점수 (100점 환산) */
  aiScore: number | null;
  /** 다가오는 마감까지 남은 일수 (지난 마감 제외, 없으면 null) */
  nearestDeadline: { days: number; label: string; date: string } | null;
}

/** 활동 목록 + 메타(태그, 작업 진행률, AI 점수, 임박 마감) 조회 */
export async function getActivitiesWithMeta(userId: string): Promise<ActivityMeta[]> {
  const acts = await db
    .select()
    .from(activities)
    .where(eq(activities.userId, userId))
    .orderBy(desc(activities.updatedAt));
  if (acts.length === 0) return [];

  const actIds = acts.map((a) => a.id);

  const tagRows = await db
    .select({ activityId: activityTags.activityId, name: tags.name })
    .from(activityTags)
    .innerJoin(tags, eq(activityTags.tagId, tags.id))
    .where(inArray(activityTags.activityId, actIds));

  const taskRows = await db
    .select({ activityId: tasks.activityId, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.activityId, actIds)));

  const reviewRows = await db
    .select()
    .from(aiReviews)
    .where(
      and(
        eq(aiReviews.userId, userId),
        inArray(aiReviews.activityId, actIds),
        eq(aiReviews.action, "evaluate_submission"),
        eq(aiReviews.status, "done"),
      ),
    )
    .orderBy(desc(aiReviews.createdAt));

  return acts.map((act) => {
    const tagNames = tagRows.filter((t) => t.activityId === act.id).map((t) => t.name);
    const actTasks = taskRows.filter((t) => t.activityId === act.id);
    const taskDone = actTasks.filter((t) => t.status === "done").length;

    const latestReview = reviewRows.find(
      (r) => r.activityId === act.id && r.overallScore !== null && r.maxScore,
    );
    const aiScore = latestReview
      ? Math.round((latestReview.overallScore! / latestReview.maxScore!) * 100)
      : null;

    return {
      ...act,
      tagNames,
      taskTotal: actTasks.length,
      taskDone,
      aiScore,
      nearestDeadline: nearestDeadlineOf(act),
    };
  });
}

export function nearestDeadlineOf(
  act: Pick<ActivityRow, "applyDeadline" | "submitDeadline" | "announceDate" | "status">,
): { days: number; label: string; date: string } | null {
  if (FINISHED_STATUSES.includes(act.status as ActivityStatus)) return null;
  const candidates: Array<{ date: string | null; label: string }> = [
    { date: act.applyDeadline, label: "지원 마감" },
    { date: act.submitDeadline, label: "결과물 제출" },
    { date: act.announceDate, label: "결과 발표" },
  ];
  let best: { days: number; label: string; date: string } | null = null;
  for (const c of candidates) {
    if (!c.date) continue;
    const days = daysUntil(c.date);
    if (days === null || days < 0) continue;
    if (!best || days < best.days) best = { days, label: c.label, date: c.date };
  }
  return best;
}

/** 소유권 검증 포함 단일 활동 조회 */
export async function getActivity(userId: string, activityId: string): Promise<ActivityRow | undefined> {
  return (await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .limit(1))[0];
}

export async function getActivityTagNames(activityId: string): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(activityTags)
    .innerJoin(tags, eq(activityTags.tagId, tags.id))
    .where(eq(activityTags.activityId, activityId));
  return rows.map((t) => t.name);
}

/** 제출물의 최신 버전 + 문서 조회 (AI 평가에서 사용) */
export async function getLatestVersionDocument(submissionId: string, userId: string) {
  const version = (await db
    .select()
    .from(submissionVersions)
    .where(eq(submissionVersions.submissionId, submissionId))
    .orderBy(desc(submissionVersions.createdAt))
    .limit(1))[0];
  if (!version) return null;
  const doc = (await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, version.documentId), eq(documents.userId, userId)))
    .limit(1))[0];
  return doc ? { version, doc } : null;
}

export async function getUserTags(userId: string): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(tags)
    .where(eq(tags.userId, userId));
  return rows.map((t) => t.name).sort((a, b) => a.localeCompare(b, "ko"));
}
