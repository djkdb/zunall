/**
 * 지원 결과 학습.
 *
 * "합격 확률 XX%" 같은 근거 없는 예측은 하지 않는다.
 * 사용자가 실제로 지원하고 기록한 결과만 세어, 어떤 조건에서 결과가 좋았는지 보여준다.
 * 표본이 적으면 숫자를 강조하지 않고 '표본 부족'이라고 분명히 말한다.
 */

export type Outcome = "won" | "lost" | "pending";

export interface OutcomeInput {
  activityId: string;
  name: string;
  type: string;
  status: string;
  /** 지원 적합도 (분석하지 않았으면 null) */
  fitScore: number | null;
  /** apply | hold | skip (분석하지 않았으면 null) */
  recommendation: string | null;
  /** 탈락했다면 어느 단계에서 (모르면 null) */
  lostStage?: string | null;
}

/**
 * 탈락 단계. "탈락" 하나로만 기록하면 "어디서 계속 떨어지는지"에 답할 수 없다.
 * 서류에서 떨어지는 사람과 면접에서 떨어지는 사람은 해야 할 일이 완전히 다르다.
 */
export const LOST_STAGES = {
  document: "서류",
  test: "과제·코테·인적성",
  interview: "면접",
  final: "최종",
} as const;
export type LostStage = keyof typeof LOST_STAGES;

/** 그 단계에서 막힐 때 먼저 할 일 */
const STAGE_ADVICE: Record<LostStage, string> = {
  document: "면접 준비보다 자기소개서·이력서를 먼저 다듬는 편이 효과적입니다. 문항 은행에서 같은 유형의 답변을 나란히 비교해 보세요.",
  test: "과제·코딩테스트·인적성 대비가 먼저입니다. 떨어진 공고의 유형을 모아 같은 형식으로 연습해 보세요.",
  interview: "서류는 통과하고 있습니다. 활동마다 예상 질문을 만들고 답변을 적어 두는 면접 준비가 먼저입니다.",
  final: "최종까지는 가고 있습니다. 역량보다는 '왜 이 회사인가'를 설명하는 지원 동기를 다듬어 보세요.",
};

export interface StageBreakdown {
  stage: LostStage;
  label: string;
  count: number;
}

export interface OutcomeBucket {
  label: string;
  applied: number;
  won: number;
  lost: number;
  pending: number;
  /** 결과가 나온 건(합격+탈락) 기준 합격률. 결과가 없으면 null */
  winRate: number | null;
  /** 결론을 내기에 충분한 표본인지 */
  enough: boolean;
}

export interface OutcomeLearning {
  totalApplied: number;
  decided: number;
  overallWinRate: number | null;
  byFit: OutcomeBucket[];
  byRecommendation: OutcomeBucket[];
  byType: OutcomeBucket[];
  /** 탈락한 지원의 단계별 수 (단계를 적은 것만) */
  lostByStage: StageBreakdown[];
  /** 탈락했지만 단계를 적지 않은 수 */
  lostStageUnknown: number;
  /** 단계를 적지 않은 탈락 (바로 가서 적을 수 있도록 최대 5건) */
  lostWithoutStage: { activityId: string; name: string }[];
  /** 데이터로 확인된 사실만 문장으로. 없으면 빈 배열 */
  insights: string[];
  /** 아직 결론을 못 내는 이유 */
  notice: string | null;
}

const MIN_SAMPLE = 3;

/** 지원한 것으로 볼 상태 (관심·지원 예정은 제외) */
const APPLIED_STATUSES = new Set([
  "applied",
  "active",
  "submitted",
  "waiting",
  "won",
  "lost",
  "done",
]);

export function outcomeOf(status: string): Outcome {
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  return "pending";
}

function emptyBucket(label: string): OutcomeBucket {
  return { label, applied: 0, won: 0, lost: 0, pending: 0, winRate: null, enough: false };
}

function finalize(bucket: OutcomeBucket): OutcomeBucket {
  const decided = bucket.won + bucket.lost;
  return {
    ...bucket,
    winRate: decided > 0 ? Math.round((bucket.won / decided) * 100) : null,
    enough: decided >= MIN_SAMPLE,
  };
}

function fitLabel(score: number | null): string {
  if (score === null) return "적합도 미분석";
  if (score >= 80) return "적합도 80+";
  if (score >= 60) return "적합도 60-79";
  return "적합도 60 미만";
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  apply: "지원 추천",
  hold: "보류 판정",
  skip: "지원 비추천",
};

export function computeOutcomeLearning(
  rows: OutcomeInput[],
  typeLabels: Record<string, string> = {},
): OutcomeLearning {
  const applied = rows.filter((r) => APPLIED_STATUSES.has(r.status));

  const group = (key: (row: OutcomeInput) => string | null) => {
    const map = new Map<string, OutcomeBucket>();
    for (const row of applied) {
      const label = key(row);
      if (label === null) continue;
      const bucket = map.get(label) ?? emptyBucket(label);
      bucket.applied++;
      const outcome = outcomeOf(row.status);
      if (outcome === "won") bucket.won++;
      else if (outcome === "lost") bucket.lost++;
      else bucket.pending++;
      map.set(label, bucket);
    }
    return [...map.values()].map(finalize).sort((a, b) => b.applied - a.applied);
  };

  const byFit = group((r) => fitLabel(r.fitScore));
  const byRecommendation = group((r) =>
    r.recommendation ? (RECOMMENDATION_LABELS[r.recommendation] ?? r.recommendation) : null,
  );
  const byType = group((r) => typeLabels[r.type] ?? r.type);

  const decided = applied.filter((r) => outcomeOf(r.status) !== "pending").length;
  const won = applied.filter((r) => r.status === "won").length;

  const insights: string[] = [];

  // 적합도 구간 비교는 양쪽 표본이 충분할 때만
  const high = byFit.find((b) => b.label === "적합도 80+");
  const low = byFit.find((b) => b.label === "적합도 60 미만");
  if (high?.enough && low?.enough && high.winRate !== null && low.winRate !== null) {
    if (high.winRate > low.winRate) {
      insights.push(
        `적합도 80 이상에서 합격률 ${high.winRate}%, 60 미만에서 ${low.winRate}% 입니다. 적합도가 높은 공고에 집중하는 편이 결과가 좋았습니다.`,
      );
    } else if (low.winRate > high.winRate) {
      insights.push(
        `적합도 60 미만에서 오히려 합격률이 높았습니다(${low.winRate}% vs ${high.winRate}%). 적합도 계산에 반영되지 않은 강점이 있는지 살펴보세요.`,
      );
    }
  }

  // 탈락 단계 — "어디서 막히는가"
  const lostRows = applied.filter((r) => r.status === "lost");
  const stageCounts = new Map<LostStage, number>();
  for (const row of lostRows) {
    if (row.lostStage && row.lostStage in LOST_STAGES) {
      const stage = row.lostStage as LostStage;
      stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
    }
  }
  const lostByStage: StageBreakdown[] = (Object.keys(LOST_STAGES) as LostStage[])
    .filter((stage) => stageCounts.has(stage))
    .map((stage) => ({ stage, label: LOST_STAGES[stage], count: stageCounts.get(stage)! }));
  const unstaged = lostRows.filter((r) => !(r.lostStage && r.lostStage in LOST_STAGES));
  const lostStageUnknown = unstaged.length;
  const lostWithoutStage = unstaged.slice(0, 5).map((r) => ({ activityId: r.activityId, name: r.name }));
  const knownLost = lostRows.length - lostStageUnknown;
  const topStage = [...lostByStage].sort((a, b) => b.count - a.count)[0];
  // 단계를 적은 탈락이 2건 이상이고, 한 단계에 절반 이상 몰렸을 때만 단정한다
  if (topStage && knownLost >= 2 && topStage.count * 2 >= knownLost) {
    insights.push(
      `탈락 ${knownLost}건 중 ${topStage.count}건이 ${topStage.label} 단계였습니다. ${STAGE_ADVICE[topStage.stage]}`,
    );
  }

  // 가장 결과가 좋았던 유형 — 비교할 유형이 둘 이상이고 실제로 붙은 적이 있을 때만.
  // 유형이 하나뿐이면 "인턴 유형에서 0/5건 합격(0%)"이 '최고'로 뽑혀, 지친 사람에게
  // 0%를 한 번 더 보여주는 꼴이 됐다.
  const comparableTypes = byType.filter((b) => b.enough && b.winRate !== null);
  const bestType =
    comparableTypes.length >= 2
      ? comparableTypes.sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0)).find((b) => (b.winRate ?? 0) > 0)
      : undefined;
  if (bestType) {
    insights.push(
      `${bestType.label} 유형에서 ${bestType.won}/${bestType.won + bestType.lost}건 합격(${bestType.winRate}%)했습니다.`,
    );
  }

  const skipped = byRecommendation.find((b) => b.label === "지원 비추천");
  if (skipped?.enough && skipped.winRate !== null && skipped.winRate < 34) {
    insights.push(
      `'지원 비추천' 판정을 받고 지원한 ${skipped.won + skipped.lost}건 중 합격은 ${skipped.won}건입니다. 판정을 참고할 만합니다.`,
    );
  }

  const notice =
    decided < MIN_SAMPLE
      ? `결과가 기록된 지원이 ${decided}건입니다. ${MIN_SAMPLE}건 이상 쌓이면 어떤 조건에서 결과가 좋았는지 알려드립니다.`
      : lostStageUnknown >= 2 && knownLost < 2
        ? `탈락한 지원 ${lostStageUnknown}건에 어느 단계였는지 적으면, 어디서 막히는지와 먼저 할 일을 알려드립니다.`
        : null;

  return {
    totalApplied: applied.length,
    decided,
    overallWinRate: decided > 0 ? Math.round((won / decided) * 100) : null,
    byFit,
    byRecommendation,
    byType,
    lostByStage,
    lostStageUnknown,
    lostWithoutStage,
    insights,
    notice,
  };
}
