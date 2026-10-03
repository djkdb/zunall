import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
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
import { newId, safeJsonParse, todayStr } from "@/lib/utils";
import { FINISHED_STATUSES, ONGOING_STATUSES } from "@/lib/constants";
import type { SnapshotInput } from "@/services/career/growth";
import { inferEvidenceFromActivities } from "@/services/career/activity-evidence";
import { matchTemplate } from "@/services/career/templates";
import { exploreCandidates, isExploringGoal, type ExploreCandidate } from "@/services/career/explore";
import {
  computeSkillScores,
  type SkillScoreDetail,
} from "@/services/score/skill";
import {
  computeReadiness,
  type ReadinessResult,
} from "@/services/score/readiness";
import { computeGaps, type GapItem } from "@/services/career/gap";
import { pickMission, type MissionCandidate } from "@/services/career/mission";
import {
  EVIDENCE_WEIGHTS,
  STUDY_FIELDS,
  type RoleTemplate,
  type StudyField,
} from "@/lib/career-constants";

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
  /**
   * 진로를 아직 정하지 못했다 ("잘 모르겠어요", "~쪽?") — 직무를 직접 고르지 않은 경우만.
   * 이때 template 은 임시 기준이고, 화면은 점수 대신 후보 비교를 보여준다.
   */
  exploring: boolean;
  /** 탐색 중일 때 나란히 비교할 후보 직무 (아니면 빈 배열) */
  candidates: ExploreCandidate[];
}

/** 저장된 값이 아는 계열일 때만 돌려준다 (알 수 없는 값이면 무시). */
export function parseStudyField(
  value: string | null | undefined,
): StudyField | null {
  return value && value in STUDY_FIELDS ? (value as StudyField) : null;
}

/** Career 화면·대시보드가 공유하는 컨텍스트를 한 번에 조립한다. */
export async function getCareerContext(userId: string): Promise<CareerContext> {
  // 서로 의존하지 않는 조회는 한꺼번에 보낸다.
  // 순서대로 기다리면 왕복 시간이 그대로 더해져 화면 이동이 느려진다.
  const [profileRows, goalRows, skills, evidence, acts, actions] =
    await Promise.all([
      db
        .select()
        .from(careerProfiles)
        .where(eq(careerProfiles.userId, userId))
        .limit(1),
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
      db
        .select({
          id: activities.id,
          name: activities.name,
          organizer: activities.organizer,
          type: activities.type,
          status: activities.status,
        })
        .from(activities)
        .where(eq(activities.userId, userId)),
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

  // 직접 남긴 근거 + 등록한 활동에서 추정한 근거.
  // 서포터즈를 하고 있는데 "마케팅 경험이 거의 없음"이라고 말하면 앱을 믿지 않는다.
  const explicitEvidence = evidence.map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    skills: safeJsonParse<string[]>(e.skills, []),
  }));
  const alreadyEvidenced = new Set(
    evidence.filter((e) => e.sourceType === "activity" && e.sourceId).map((e) => e.sourceId as string),
  );
  const inferredEvidence = inferEvidenceFromActivities(acts, alreadyEvidenced, EVIDENCE_WEIGHTS);

  const skillScores = computeSkillScores(
    skills.map((s) => ({
      name: s.name,
      category: s.category,
      selfScore: s.selfScore,
    })),
    [...explicitEvidence, ...inferredEvidence],
  );

  const readiness = computeReadiness({
    template,
    skillScores,
    evidenceCount: evidence.length,
    activityStats: {
      total: acts.length,
      finished: acts.filter((a) =>
        (FINISHED_STATUSES as string[]).includes(a.status),
      ).length,
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
  const studyField = parseStudyField(profile?.studyField);
  const exploring = !profile?.roleKey && isExploringGoal(goal?.name);
  const candidates = exploring && goal ? exploreCandidates(goal.name, studyField, skillScores) : [];

  // 정하지 못한 사람에게 임시 기준의 격차를 메우라고 하지 않는다 — 후보를 작게 먼저 해 보게 한다
  const experiment = candidates.find((c) => !excludeTitles.has(c.experiment.title));
  const mission: MissionCandidate | null = exploring
    ? experiment
      ? {
          skill: "진로 탐색",
          title: experiment.experiment.title,
          reason: experiment.experiment.why,
          expectedEffect: 0,
          expectedMinutes: experiment.experiment.minutes,
          why: `'${experiment.label}' 쪽이 나에게 맞는지 알아보는 작은 실험입니다. ${experiment.experiment.why}`,
        }
      : null
    : pickMission(gaps, excludeTitles);
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
    studyField,
    mission,
    activeAction,
    onboarded: !!profile?.onboardedAt && !!goal,
    exploring,
    candidates,
  };
}

/**
 * 커리어 점수 스냅샷 기록 — 하루 한 점.
 *
 * 성장 그래프의 원천이다. 화면을 열 때마다 불리므로 왕복 한 번으로 끝낸다
 * (user_id + day 유니크 인덱스 위의 upsert). 같은 날 여러 번 불려도
 * 마지막 값으로 갱신되고 행은 늘지 않는다.
 */
export async function recordScoreSnapshot(
  userId: string,
  score: number,
  breakdown: unknown,
): Promise<void> {
  const day = todayStr();
  try {
    await db.execute(sql`
    INSERT INTO score_snapshots (id, user_id, day, score, breakdown, created_at)
    VALUES (${newId()}, ${userId}, ${day}, ${score}, ${JSON.stringify(breakdown)}, ${Date.now()})
    ON CONFLICT (user_id, day)
    DO UPDATE SET score = EXCLUDED.score,
                  breakdown = EXCLUDED.breakdown,
                  created_at = EXCLUDED.created_at
    `);
  } catch (error) {
    // 성장 기록은 부가 기능이다. 이게 실패해서 첫 화면이 안 열리면 안 된다.
    // 삼키지 않고 남겨서, 무엇이 실패했는지는 로그로 확인할 수 있게 한다.
    console.error(
      "성장 기록 저장 실패:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * 성장 기록 원천 데이터 (최근 n일).
 * 하루 한 점이므로 90일이면 최대 90행 — 한 번의 조회로 충분하다.
 */
export async function getScoreHistory(
  userId: string,
  days = 90,
): Promise<SnapshotInput[]> {
  const since = Date.now() - days * 86_400_000;
  try {
    const rows = await db
      .select()
      .from(scoreSnapshots)
      .where(
        and(
          eq(scoreSnapshots.userId, userId),
          gte(scoreSnapshots.createdAt, since),
        ),
      )
      .orderBy(scoreSnapshots.createdAt);

    return rows.map((row) => ({
      day: row.day,
      // HTTP 드라이버는 bigint·double 을 문자열로 돌려주기도 한다. 숫자로 고정한다.
      score: Number(row.score),
      items: safeJsonParse<SnapshotInput["items"]>(row.breakdown, []),
      createdAt: Number(row.createdAt),
    }));
  } catch (error) {
    // 기록을 못 읽어도 화면은 열려야 한다 (성장 카드만 "아직 기록 없음"으로 나온다)
    console.error(
      "성장 기록 조회 실패:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export async function getScoreTrend(
  userId: string,
): Promise<{
  first: number | null;
  latest: number | null;
  monthAgo: number | null;
}> {
  const rows = await db
    .select()
    .from(scoreSnapshots)
    .where(eq(scoreSnapshots.userId, userId))
    .orderBy(scoreSnapshots.createdAt);
  if (rows.length === 0) return { first: null, latest: null, monthAgo: null };
  const monthStart = Date.now() - 30 * 86400000;
  const monthAgoRow =
    rows.filter((r) => r.createdAt <= monthStart).pop() ?? rows[0];
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
export async function handleTaskCompletionForCareer(
  userId: string,
  taskId: string,
): Promise<boolean> {
  const linkedAction = (
    await db
      .select()
      .from(careerActions)
      .where(
        and(eq(careerActions.userId, userId), eq(careerActions.taskId, taskId)),
      )
      .limit(1)
  )[0];

  const linkedRoadmap = (
    await db
      .select()
      .from(roadmapItems)
      .where(
        and(eq(roadmapItems.userId, userId), eq(roadmapItems.taskId, taskId)),
      )
      .limit(1)
  )[0];

  let missionDone = false;
  if (linkedAction && linkedAction.status !== "done") {
    await db
      .update(careerActions)
      .set({ status: "done", updatedAt: Date.now() })
      .where(eq(careerActions.id, linkedAction.id));
    missionDone = true;
  }
  if (linkedRoadmap && linkedRoadmap.status !== "done") {
    await db
      .update(roadmapItems)
      .set({ status: "done" })
      .where(eq(roadmapItems.id, linkedRoadmap.id));
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
  return rows.filter((a) => (ONGOING_STATUSES as string[]).includes(a.status))
    .length;
}

/** AI 프롬프트에 넣는 한 줄 프로필 (자소서 첨삭 등에서 공용) */
export async function buildProfileText(userId: string): Promise<string> {
  // 이름은 넣지 않는다 — 판단에 필요 없고, AI 에 개인정보를 보낼 이유가 없다
  const goal = (
    await db
      .select()
      .from(careerGoals)
      .where(and(eq(careerGoals.userId, userId), eq(careerGoals.isActive, 1)))
      .limit(1)
  )[0];
  const profile = (
    await db
      .select()
      .from(careerProfiles)
      .where(eq(careerProfiles.userId, userId))
      .limit(1)
  )[0];

  return [
    goal ? `커리어 목표: ${goal.name}.` : null,
    profile?.headline ? `프로필: ${profile.headline}.` : null,
    profile?.summary ? `소개: ${profile.summary}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
