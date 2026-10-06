import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import {
  db,
  activities,
  careerEvidence,
  careerGoals,
  careerProfiles,
  documents,
  essayDrafts,
  essayQuestions,
  events,
  mockInterviews,
} from "@/lib/db";
import type { Interview } from "@/services/mock-interview/types";
import { CATEGORY_KEYS, type CategoryKey } from "@/services/mock-interview/shared/schemas";
import { COMPANIES } from "@/services/mock-interview/shared/companies";
import { todayStr, toDateStr } from "@/lib/utils";

/** 면접 기록 목록 (최신순). 점수 추이·자주 약한 항목 계산용으로 최근 완료분의 항목 점수도 함께. */
export async function getMockInterviewHistory(userId: string) {
  const rows = await db
    .select({
      id: mockInterviews.id,
      activityId: mockInterviews.activityId,
      position: mockInterviews.position,
      companyName: mockInterviews.companyName,
      status: mockInterviews.status,
      overallScore: mockInterviews.overallScore,
      createdAt: mockInterviews.createdAt,
    })
    .from(mockInterviews)
    .where(eq(mockInterviews.userId, userId))
    .orderBy(desc(mockInterviews.createdAt))
    .limit(50);

  const recentDone = rows.filter((r) => r.status === "completed").slice(0, 5);
  const details = recentDone.length
    ? await db
        .select({ id: mockInterviews.id, data: mockInterviews.data })
        .from(mockInterviews)
        .where(and(eq(mockInterviews.userId, userId), inArray(mockInterviews.id, recentDone.map((r) => r.id))))
    : [];
  const totals = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>;
  let counted = 0;
  for (const d of details) {
    try {
      const scores = (JSON.parse(d.data) as Interview).categoryScores;
      if (!scores) continue;
      for (const k of CATEGORY_KEYS) totals[k] += scores[k];
      counted++;
    } catch {
      // 깨진 기록은 건너뛴다
    }
  }
  const averages = counted ? (Object.fromEntries(CATEGORY_KEYS.map((k) => [k, Math.round(totals[k] / counted)])) as Record<CategoryKey, number>) : null;
  return { rows, averages, averagedOver: counted };
}

/** 앞으로 2주 안 면접 일정 (활동과 연결된 것) */
export async function getUpcomingInterviews(userId: string) {
  // 앱의 다른 D-day 계산과 같은 기준(서버 로컬 날짜)을 쓴다
  const today = todayStr();
  const until = toDateStr(new Date(Date.now() + 14 * 86400000));
  return db
    .select({ id: events.id, title: events.title, date: events.date, activityId: events.activityId, activityName: activities.name })
    .from(events)
    .leftJoin(activities, eq(activities.id, events.activityId))
    .where(and(eq(events.userId, userId), eq(events.type, "interview"), gte(events.date, today), sql`${events.date} <= ${until}`))
    .orderBy(asc(events.date))
    .limit(5);
}

/** 설정 화면용: 내 활동(자소서·공고 유무), 커리어 목표, 근거 유무 */
export async function getSetupContext(userId: string) {
  const [acts, essayActs, noticeActs, profile, goal, evidenceCount] = await Promise.all([
    db
      .select({ id: activities.id, name: activities.name, organizer: activities.organizer, type: activities.type, status: activities.status })
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.updatedAt))
      .limit(80),
    db
      .selectDistinct({ activityId: essayQuestions.activityId })
      .from(essayQuestions)
      .innerJoin(essayDrafts, eq(essayDrafts.questionId, essayQuestions.id))
      .where(and(eq(essayQuestions.userId, userId), eq(essayDrafts.userId, userId), sql`length(${essayDrafts.content}) > 0`)),
    db
      .selectDistinct({ activityId: documents.activityId })
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.category, "notice"), isNotNull(documents.extractedText))),
    db.select({ roleKey: careerProfiles.roleKey }).from(careerProfiles).where(eq(careerProfiles.userId, userId)).limit(1),
    db
      .select({ name: careerGoals.name })
      .from(careerGoals)
      .where(and(eq(careerGoals.userId, userId), eq(careerGoals.isActive, 1)))
      .limit(1),
    db.select({ n: sql<number>`count(*)` }).from(careerEvidence).where(eq(careerEvidence.userId, userId)),
  ]);
  const withEssays = new Set(essayActs.map((r) => r.activityId));
  const withNotice = new Set(noticeActs.map((r) => r.activityId));
  // 채용·인턴 공고를 위로 (면접이 있는 활동)
  const JOBISH = new Set(["recruit", "intern"]);
  const sorted = [...acts].sort((a, b) => Number(JOBISH.has(b.type)) - Number(JOBISH.has(a.type)));
  return {
    activities: sorted.map((a) => ({ id: a.id, name: a.name, organizer: a.organizer, hasEssays: withEssays.has(a.id), hasNotice: withNotice.has(a.id) })),
    roleKey: profile[0]?.roleKey ?? null,
    goalName: goal[0]?.name ?? null,
    hasEvidence: Number(evidenceCount[0]?.n ?? 0) > 0,
  };
}

/** 활동 이름·주최로 면접 연습용 기업을 찾는다 ("카카오 서버 개발 인턴" → 카카오) */
export function companyFromText(text: string): string | null {
  const t = text.replace(/\s+/g, "");
  let best: { id: string; len: number } | null = null;
  for (const c of COMPANIES) {
    for (const name of [c.name, c.shortName].filter(Boolean) as string[]) {
      const n = name.replace(/\s+/g, "");
      if (n.length >= 2 && t.includes(n) && (!best || n.length > best.len)) best = { id: c.id, len: n.length };
    }
  }
  return best?.id ?? null;
}
