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

  const bestType = byType.filter((b) => b.enough && b.winRate !== null).sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];
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
      : null;

  return {
    totalApplied: applied.length,
    decided,
    overallWinRate: decided > 0 ? Math.round((won / decided) * 100) : null,
    byFit,
    byRecommendation,
    byType,
    insights,
    notice,
  };
}
