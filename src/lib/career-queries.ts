import "server-only";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  activities,
  careerGoals,
  careerProfiles,
  careerActions,
  careerEvidence,
  userSkills,
  scoreSnapshots,
  roadmapItems,
  users,
  type CareerGoalRow,
  type CareerProfileRow,
  type EvidenceRow,
} from "@/lib/db";
import { newId, safeJsonParse, toDateStr, todayStr } from "@/lib/utils";
import { FINISHED_STATUSES, ONGOING_STATUSES } from "@/lib/constants";
import { matchTemplate } from "@/services/career/templates";
import { computeSkillScores, type SkillScoreDetail } from "@/services/score/skill";
import { computeReadiness, type ReadinessResult } from "@/services/score/readiness";
import { computeGaps, type GapItem } from "@/services/career/gap";
import { pickMission, type MissionCandidate } from "@/services/career/mission";
import { STUDY_FIELDS, type RoleTemplate, type StudyField } from "@/lib/career-constants";

export interface CareerContext {
  profile: CareerProfileRow | null;
  goal: CareerGoalRow | null;
  template: RoleTemplate;
  skillScores: SkillScoreDetail[];
  evidence: EvidenceRow[];
  readiness: ReadinessResult;
  gaps: GapItem[];
  /** 프로필에 저장된 전공 계열 (스킬·활동 추천에 사용) */
  studyField: StudyField | null;
  mission: MissionCandidate | null;
  /** 진행 중(accepted)인 미션 액션 */
  activeAction: typeof careerActions.$inferSelect | null;
  onboarded: boolean;
}

/** 저장된 값이 아는 계열일 때만 돌려준다 (알 수 없는 값이면 무시). */
export function parseStudyField(value: string | null | undefined): StudyField | null {
  return value && value in STUDY_FIELDS ? (value as StudyField) : null;
}

/** Career 화면·대시보드가 공유하는 컨텍스트를 한 번에 조립한다. */
export async function getCareerContext(userId: string): Promise<CareerContext> {
  // 서로 의존하지 않는 조회는 한꺼번에 보낸다.
  // 순서대로 기다리면 왕복 시간이 그대로 더해져 화면 이동이 느려진다.
  const [profileRows, goalRows, skills, evidence, acts, actions] = await Promise.all([
    db.select().from(careerProfiles).where(eq(careerProfiles.userId, userId)).limit(1),
    db
      .select()
      .from(careerGoals)
      .where(and(eq(careerGoals.userId, userId), eq(careerGoals.isActive, 1)))
      .orderBy(desc(careerGoals.updatedAt))
      .limit(1),
    db.select().from(userSkills).where(eq(userSkills.userId, userId)),
    db
      .select()
      .from(careerEvidence)
      .where(eq(careerEvidence.userId, userId))
      .orderBy(desc(careerEvidence.createdAt)),
    db.select({ status: activities.status }).from(activities).where(eq(activities.userId, userId)),
    db.select().from(careerActions).where(eq(careerActions.userId, userId)),
  ]);
  const profile = profileRows[0] ?? null;
  const goal = goalRows[0] ?? null;

  const template = matchTemplate(
    goal
      ? {
          name: goal.name,
          type: goal.type,
          targetRoles: safeJsonParse<string[]>(goal.targetRoles, []),
        }
      : null,
    profile?.roleKey,
  );

  const skillScores = computeSkillScores(
    skills.map((s) => ({ name: s.name, category: s.category, selfScore: s.selfScore })),
    evidence.map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      skills: safeJsonParse<string[]>(e.skills, []),
    })),
  );

  const readiness = computeReadiness({
    template,
    skillScores,
    evidenceCount: evidence.length,
    activityStats: {
      total: acts.length,
      finished: acts.filter((a) => (FINISHED_STATUSES as string[]).includes(a.status)).length,
      won: acts.filter((a) => a.status === "won").length,
    },
    profile: {
      hasGoal: !!goal,
      hasHeadline: !!profile?.headline,
      hasSummary: !!profile?.summary,
      skillCount: skills.length,
    },
  });

  const gaps = computeGaps(template, skillScores);

  const excludeTitles = new Set(
    actions.filter((a) => a.status !== "suggested").map((a) => a.title),
  );
  const mission = pickMission(gaps, excludeTitles);
  const activeAction =
    actions
      .filter((a) => a.status === "accepted")
      .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;

  return {
    profile,
    goal,
    template,
    skillScores,
    evidence,
    readiness,
    gaps,
    studyField: parseStudyField(profile?.studyField),
    mission,
    activeAction,
    onboarded: !!profile?.onboardedAt && !!goal,
  };
}

/**
 * Career Score 스냅샷 기록 (하루 1개 이상이면 최신값으로 갱신).
 * 성장 그래프("72 → 81")의 데이터가 된다.
 */
export async function recordScoreSnapshot(userId: string, score: number, breakdown: unknown): Promise<void> {
  const latest = (await db
    .select()
    .from(scoreSnapshots)
    .where(eq(scoreSnapshots.userId, userId))
    .orderBy(desc(scoreSnapshots.createdAt))
    .limit(1))[0];

  const breakdownJson = JSON.stringify(breakdown);
  const latestDay = latest ? toDateStr(new Date(latest.createdAt)) : null;
  if (latest && latestDay === todayStr()) {
    // 같은 날에는 최신값으로 갱신만 한다
    await db.update(scoreSnapshots)
      .set({ score, breakdown: breakdownJson, createdAt: Date.now() })
      .where(eq(scoreSnapshots.id, latest.id));
    return;
  }
  await db.insert(scoreSnapshots)
    .values({ id: newId(), userId, score, breakdown: breakdownJson, createdAt: Date.now() });
}

export async function getScoreTrend(userId: string): Promise<{ first: number | null; latest: number | null; monthAgo: number | null }> {
  const rows = await db
    .select()
    .from(scoreSnapshots)
    .where(eq(scoreSnapshots.userId, userId))
    .orderBy(scoreSnapshots.createdAt);
  if (rows.length === 0) return { first: null, latest: null, monthAgo: null };
  const monthStart = Date.now() - 30 * 86400000;
  const monthAgoRow = rows.filter((r) => r.createdAt <= monthStart).pop() ?? rows[0];
  return {
    first: rows[0].score,
    latest: rows[rows.length - 1].score,
    monthAgo: monthAgoRow.score,
  };
}

/**
 * Task 완료 시 Career 연동 처리:
 * 연결된 미션 액션/로드맵 항목을 완료로 바꾸고 Career Score 스냅샷을 갱신한다.
 * 반환: 커리어 미션이 완료되었는지 여부.
 */
export async function handleTaskCompletionForCareer(userId: string, taskId: string): Promise<boolean> {
  const linkedAction = (await db
    .select()
    .from(careerActions)
    .where(and(eq(careerActions.userId, userId), eq(careerActions.taskId, taskId)))
    .limit(1))[0];

  const linkedRoadmap = (await db
    .select()
    .from(roadmapItems)
    .where(and(eq(roadmapItems.userId, userId), eq(roadmapItems.taskId, taskId)))
    .limit(1))[0];

  let missionDone = false;
  if (linkedAction && linkedAction.status !== "done") {
    await db.update(careerActions)
      .set({ status: "done", updatedAt: Date.now() })
      .where(eq(careerActions.id, linkedAction.id));
    missionDone = true;
  }
  if (linkedRoadmap && linkedRoadmap.status !== "done") {
    await db.update(roadmapItems).set({ status: "done" }).where(eq(roadmapItems.id, linkedRoadmap.id));
  }

  if (missionDone || linkedRoadmap) {
    const ctx = await getCareerContext(userId);
    await recordScoreSnapshot(userId, ctx.readiness.score, ctx.readiness.items);
  }
  return missionDone;
}

/** 진행 중 활동 수 (대시보드 헤더용 재사용) */
export async function countOngoingActivities(userId: string): Promise<number> {
  const rows = await db
    .select({ status: activities.status })
    .from(activities)
    .where(eq(activities.userId, userId));
  return rows.filter((a) => (ONGOING_STATUSES as string[]).includes(a.status)).length;
}

/** AI 프롬프트에 넣는 한 줄 프로필 (자소서 첨삭 등에서 공용) */
export async function buildProfileText(userId: string): Promise<string> {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  const goal = (
    await db
      .select()
      .from(careerGoals)
      .where(and(eq(careerGoals.userId, userId), eq(careerGoals.isActive, 1)))
      .limit(1)
  )[0];
  const profile = (
    await db.select().from(careerProfiles).where(eq(careerProfiles.userId, userId)).limit(1)
  )[0];

  return [
    `이름: ${user?.name ?? "사용자"}.`,
    goal ? `커리어 목표: ${goal.name}.` : null,
    profile?.headline ? `프로필: ${profile.headline}.` : null,
    profile?.summary ? `소개: ${profile.summary}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
