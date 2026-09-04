import "server-only";
import { and, desc, eq, sql, inArray } from "drizzle-orm";
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

  // 태그·작업·AI 평가는 서로 독립적이라 한 번에 보낸다.
  const [tagRows, taskRows, reviewRows] = await Promise.all([
    db
      .select({ activityId: activityTags.activityId, name: tags.name })
      .from(activityTags)
      .innerJoin(tags, eq(activityTags.tagId, tags.id))
      .where(inArray(activityTags.activityId, actIds)),
    db
      .select({ activityId: tasks.activityId, status: tasks.status })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), inArray(tasks.activityId, actIds))),
    db
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
      .orderBy(desc(aiReviews.createdAt)),
  ]);

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

export async function getActivityTagNames(userId: string, activityId: string): Promise<string[]> {
  // 활동을 조인해 소유자까지 확인한다. 남의 활동 id 로는 빈 배열이 나온다.
  const rows = await db
    .select({ name: tags.name })
    .from(activityTags)
    .innerJoin(tags, eq(activityTags.tagId, tags.id))
    .innerJoin(activities, eq(activityTags.activityId, activities.id))
    .where(and(eq(activityTags.activityId, activityId), eq(activities.userId, userId)));
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

/**
 * 활동 상세의 탭 배지 숫자.
 *
 * 서버리스 DB(Neon HTTP 등)에서는 쿼리 하나가 곧 네트워크 왕복 하나다.
 * 탭마다 따로 세면 여섯 번을 왕복하게 되므로, 한 번의 질의로 모아 온다.
 */
/**
 * 가이드 체크리스트에 쓰는 개수 5종을 한 번의 쿼리로 센다.
 * 모두 userId 로 걸러 다른 사용자 자료는 세지 않는다.
 */
export async function getGuideCounts(userId: string): Promise<{
  goals: number;
  evidence: number;
  activities: number;
  reviews: number;
  retrospectives: number;
}> {
  const rows = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM career_goals WHERE user_id = ${userId} AND is_active = 1) AS goals,
      (SELECT count(*) FROM career_evidence WHERE user_id = ${userId}) AS evidence,
      (SELECT count(*) FROM activities WHERE user_id = ${userId}) AS activities,
      (SELECT count(*) FROM ai_reviews WHERE user_id = ${userId} AND status = 'done') AS reviews,
      (SELECT count(*) FROM retrospectives WHERE user_id = ${userId}) AS retrospectives
  `)) as unknown as Array<Record<string, unknown>> | { rows?: Array<Record<string, unknown>> };

  const row = (Array.isArray(rows) ? rows[0] : rows.rows?.[0]) ?? {};
  const num = (value: unknown) => Number(value ?? 0);
  return {
    goals: num(row.goals),
    evidence: num(row.evidence),
    activities: num(row.activities),
    reviews: num(row.reviews),
    retrospectives: num(row.retrospectives),
  };
}

export async function getActivityTabCounts(
  userId: string,
  activityId: string,
): Promise<{
  calendar: number;
  documents: number;
  tasks: number;
  submissions: number;
  ai: number;
  history: number;
  interview: number;
}> {
  // 모든 하위 집계를 user_id 로도 걸러, 남의 활동 id 를 넣어도 0 만 나온다.
  const rows = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM events WHERE activity_id = ${activityId} AND user_id = ${userId}) AS calendar,
      (SELECT count(*) FROM documents WHERE activity_id = ${activityId} AND user_id = ${userId}) AS documents,
      (SELECT count(*) FROM tasks WHERE activity_id = ${activityId} AND user_id = ${userId} AND status <> 'done') AS tasks,
      (SELECT count(*) FROM submissions WHERE activity_id = ${activityId} AND user_id = ${userId}) AS submissions,
      (SELECT count(*) FROM ai_reviews WHERE activity_id = ${activityId} AND user_id = ${userId} AND status = 'done') AS ai,
      (SELECT count(*) FROM activity_history WHERE activity_id = ${activityId} AND user_id = ${userId}) AS history,
      (SELECT count(*) FROM interview_questions WHERE activity_id = ${activityId} AND user_id = ${userId} AND ready = 0) AS interview
  `)) as unknown as Array<Record<string, unknown>> | { rows?: Array<Record<string, unknown>> };

  const row = (Array.isArray(rows) ? rows[0] : rows.rows?.[0]) ?? {};
  const num = (value: unknown) => Number(value ?? 0);
  return {
    calendar: num(row.calendar),
    documents: num(row.documents),
    tasks: num(row.tasks),
    submissions: num(row.submissions),
    ai: num(row.ai),
    history: num(row.history),
    interview: num(row.interview),
  };
}
