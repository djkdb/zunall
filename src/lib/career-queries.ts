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
import type { RoleTemplate } from "@/lib/career-constants";

export interface CareerContext {
  profile: CareerProfileRow | null;
  goal: CareerGoalRow | null;
  template: RoleTemplate;
  skillScores: SkillScoreDetail[];
  evidence: EvidenceRow[];
  readiness: ReadinessResult;
  gaps: GapItem[];
  mission: MissionCandidate | null;
  /** 진행 중(accepted)인 미션 액션 */
  activeAction: typeof careerActions.$inferSelect | null;
  onboarded: boolean;
}

/** Career 화면·대시보드가 공유하는 컨텍스트를 한 번에 조립한다. */
export function getCareerContext(userId: string): CareerContext {
  const profile =
    db.select().from(careerProfiles).where(eq(careerProfiles.userId, userId)).get() ?? null;

  const goal =
    db
      .select()
      .from(careerGoals)
      .where(and(eq(careerGoals.userId, userId), eq(careerGoals.isActive, 1)))
      .orderBy(desc(careerGoals.updatedAt))
      .get() ?? null;

  const template = matchTemplate(
    goal
      ? {
          name: goal.name,
          type: goal.type,
          targetRoles: safeJsonParse<string[]>(goal.targetRoles, []),
        }
      : null,
  );

  const skills = db.select().from(userSkills).where(eq(userSkills.userId, userId)).all();
  const evidence = db
    .select()
    .from(careerEvidence)
    .where(eq(careerEvidence.userId, userId))
    .orderBy(desc(careerEvidence.createdAt))
    .all();

  const skillScores = computeSkillScores(
    skills.map((s) => ({ name: s.name, category: s.category, selfScore: s.selfScore })),
    evidence.map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      skills: safeJsonParse<string[]>(e.skills, []),
    })),
  );

  const acts = db
    .select({ status: activities.status })
    .from(activities)
    .where(eq(activities.userId, userId))
    .all();

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

  const actions = db
    .select()
    .from(careerActions)
    .where(eq(careerActions.userId, userId))
    .all();
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
    mission,
    activeAction,
    onboarded: !!profile?.onboardedAt && !!goal,
  };
}

/**
 * Career Score 스냅샷 기록 (하루 1개 이상이면 최신값으로 갱신).
 * 성장 그래프("72 → 81")의 데이터가 된다.
 */
export function recordScoreSnapshot(userId: string, score: number, breakdown: unknown): void {
  const latest = db
    .select()
    .from(scoreSnapshots)
    .where(eq(scoreSnapshots.userId, userId))
    .orderBy(desc(scoreSnapshots.createdAt))
    .get();

  const breakdownJson = JSON.stringify(breakdown);
  const latestDay = latest ? toDateStr(new Date(latest.createdAt)) : null;
  if (latest && latestDay === todayStr()) {
    // 같은 날에는 최신값으로 갱신만 한다
    db.update(scoreSnapshots)
      .set({ score, breakdown: breakdownJson, createdAt: Date.now() })
      .where(eq(scoreSnapshots.id, latest.id))
      .run();
    return;
  }
  db.insert(scoreSnapshots)
    .values({ id: newId(), userId, score, breakdown: breakdownJson, createdAt: Date.now() })
    .run();
}

export function getScoreTrend(userId: string): { first: number | null; latest: number | null; monthAgo: number | null } {
  const rows = db
    .select()
    .from(scoreSnapshots)
    .where(eq(scoreSnapshots.userId, userId))
    .orderBy(scoreSnapshots.createdAt)
    .all();
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
export function handleTaskCompletionForCareer(userId: string, taskId: string): boolean {
  const linkedAction = db
    .select()
    .from(careerActions)
    .where(and(eq(careerActions.userId, userId), eq(careerActions.taskId, taskId)))
    .get();

  const linkedRoadmap = db
    .select()
    .from(roadmapItems)
    .where(and(eq(roadmapItems.userId, userId), eq(roadmapItems.taskId, taskId)))
    .get();

  let missionDone = false;
  if (linkedAction && linkedAction.status !== "done") {
    db.update(careerActions)
      .set({ status: "done", updatedAt: Date.now() })
      .where(eq(careerActions.id, linkedAction.id))
      .run();
    missionDone = true;
  }
  if (linkedRoadmap && linkedRoadmap.status !== "done") {
    db.update(roadmapItems).set({ status: "done" }).where(eq(roadmapItems.id, linkedRoadmap.id)).run();
  }

  if (missionDone || linkedRoadmap) {
    const ctx = getCareerContext(userId);
    recordScoreSnapshot(userId, ctx.readiness.score, ctx.readiness.items);
  }
  return missionDone;
}

/** 진행 중 활동 수 (대시보드 헤더용 재사용) */
export function countOngoingActivities(userId: string): number {
  return db
    .select({ status: activities.status })
    .from(activities)
    .where(eq(activities.userId, userId))
    .all()
    .filter((a) => (ONGOING_STATUSES as string[]).includes(a.status)).length;
}
