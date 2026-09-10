// Opportunity Fit 점수 (순수 함수 — 테스트 가능).
// AI가 추출한 공고 요구사항과 사용자의 스킬/근거/Gap을 비교해
// "지원 적합도"를 설명 가능한 가산 항목으로 계산한다.
// 이 점수는 합격 확률이 아니라 휴리스틱 기반 적합도다.

import type { RoleTemplate } from "@/lib/career-constants";
import type { SkillScoreDetail } from "./skill";
import type { GapItem } from "@/services/career/gap";

export interface OpportunityRequirementsInput {
  requiredSkills: string[]; // 카탈로그 스킬명으로 정규화된 요구 역량
  preferredSkills: string[];
  qualifications: string[];
  submissionItems: string[];
}

export interface FitBreakdownItem {
  label: string;
  points: number; // 양수/음수
  type: "plus" | "warn";
}

export interface OpportunityFitResult {
  score: number; // 0~100
  breakdown: FitBreakdownItem[];
  strengths: string[]; // ✓ 항목
  weaknesses: string[]; // ⚠ 항목
  /** 이 기회를 준비하는 데 드는 예상 시간 */
  prepHours: number;
  /** 이 기회가 현재 Career Gap을 얼마나 줄여주는가 (Career Score 환산 추정) */
  gapEffect: number;
  recommendation: "apply" | "hold" | "skip";
  recommendationReason: string;
  /** skip일 때 제안하는 대안 행동 */
  alternative: { title: string; effect: number; minutes: number } | null;
}

/**
 * 학생이 마감까지 실제로 낼 수 있는 하루 준비 시간.
 * 수업·알바·다른 마감이 있으므로 "남은 날 × 24시간"은 현실이 아니다.
 */
const HOURS_PER_DAY = 3;

/**
 * 준비 1시간이 목표에 가까워지는 정도의 하한.
 * 이 아래면 "붙을 수 있는 공고"라도 지금 쓸 시간은 아니다.
 * 0.03 = 목표 점수 1점을 얻는 데 33시간 넘게 드는 수준.
 */
const MIN_EFFICIENCY = 0.03;

/**
 * 이 시간 아래로는 "시간이 아깝다"고 말리지 않는다.
 * 준비가 몇 시간이면 목표에 직접 도움이 안 되더라도 해볼 만하다.
 * 말릴 값어치가 있으려면 비용이 실제로 커야 한다.
 */
const COSTLY_HOURS = 15;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function computeOpportunityFit(params: {
  requirements: OpportunityRequirementsInput;
  skillScores: SkillScoreDetail[];
  gaps: GapItem[];
  template: RoleTemplate;
  /** 지원 마감까지 남은 일수. 양수=남음, 0=오늘, 음수=지남, null=모름 */
  daysUntilDeadline?: number | null;
}): OpportunityFitResult {
  const {
    requirements,
    skillScores,
    gaps,
    template,
    daysUntilDeadline = null,
  } = params;
  const scoreByName = new Map(skillScores.map((s) => [s.name, s]));
  const templateSkills = new Set(template.requirements.map((r) => r.skill));

  const breakdown: FitBreakdownItem[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 40; // 기본점

  // 1) 요구 역량 매치 — 요구 역량이 적을수록 개별 역량의 비중이 크다
  const requiredList = requirements.requiredSkills.slice(0, 6);
  const perSkillPoints =
    requiredList.length <= 2 ? 14 : requiredList.length <= 4 ? 10 : 8;
  let missingRequired = 0;
  for (const skillName of requiredList) {
    const detail = scoreByName.get(skillName);
    const current = detail?.score ?? 0;
    if (current >= 60) {
      score += perSkillPoints;
      breakdown.push({
        label: `요구 역량 충족: ${skillName} (${current})`,
        points: perSkillPoints,
        type: "plus",
      });
      strengths.push(
        `${skillName} 역량이 강함 (근거 ${detail?.evidenceCount ?? 0}개)`,
      );
    } else if (current >= 35) {
      const pts = Math.round(perSkillPoints / 2);
      score += pts;
      breakdown.push({
        label: `요구 역량 일부 충족: ${skillName} (${current})`,
        points: pts,
        type: "plus",
      });
      weaknesses.push(`${skillName} 근거가 더 필요함 (현재 ${current})`);
    } else {
      missingRequired++;
      const pts = -6;
      score += pts;
      breakdown.push({
        label: `요구 역량 부족: ${skillName} (${current})`,
        points: pts,
        type: "warn",
      });
      weaknesses.push(`${skillName} 경험이 거의 없음`);
    }
  }

  // 2) 우대 역량 매치
  for (const skillName of requirements.preferredSkills.slice(0, 4)) {
    const current = scoreByName.get(skillName)?.score ?? 0;
    if (current >= 55) {
      const pts = 3;
      score += pts;
      breakdown.push({
        label: `우대 사항 보유: ${skillName}`,
        points: pts,
        type: "plus",
      });
      strengths.push(`우대 역량 ${skillName} 보유`);
    }
  }

  // 3) 목표 정렬: 이 기회가 요구하는 역량이 내 목표 직무 역량과 겹치는가
  const aligned = requirements.requiredSkills.filter((s) =>
    templateSkills.has(s),
  );
  if (aligned.length > 0) {
    const pts = Math.min(10, aligned.length * 3);
    score += pts;
    breakdown.push({
      label: `목표(${template.label})와 정렬된 역량 ${aligned.length}개`,
      points: pts,
      type: "plus",
    });
  } else if (requirements.requiredSkills.length > 0) {
    const pts = -5;
    score += pts;
    breakdown.push({
      label: "현재 목표 직무와 요구 역량이 거의 겹치지 않음",
      points: pts,
      type: "warn",
    });
    weaknesses.push("현재 목표와의 연관성이 낮음");
  }

  score = clamp(Math.round(score), 5, 97);

  // 4) 준비 시간 추정
  const prepHours =
    Math.round(
      (4 + requirements.submissionItems.length * 4 + missingRequired * 6) * 10,
    ) / 10;

  // 5) Career Gap 감소 효과: 이 기회가 훈련시키는 역량이 내 Gap과 겹치는가
  let gapEffect = 0;
  const trainedGaps: string[] = [];
  for (const gap of gaps.slice(0, 5)) {
    if (
      requirements.requiredSkills.includes(gap.skill) ||
      requirements.preferredSkills.includes(gap.skill)
    ) {
      gapEffect += Math.min(2.5, gap.gap / 12);
      trainedGaps.push(gap.skill);
    }
  }
  gapEffect = Math.round(gapEffect * 10) / 10;

  // 6) 지원 판단: "좋은 기회인가"가 아니라 "지금 나에게 좋은 기회인가"
  //
  // 적합도만으로 정하면 "붙을 수는 있지만 목표와 무관하고 시간만 많이 드는 공고"를
  // 추천하게 된다. 학생에게 모자란 것은 기회가 아니라 시간이므로,
  // 마감까지 실제로 낼 수 있는 시간과 준비 1시간당 효과를 함께 본다.
  let recommendation: OpportunityFitResult["recommendation"];
  let recommendationReason: string;

  const topGap = gaps[0];
  const altAction = topGap?.actions[0];
  // 지원을 말릴 때는 반드시 대신 할 일을 함께 준다. 말리기만 하면 도움이 안 된다.
  const alternativeAction = altAction
    ? {
        title: altAction.title,
        effect: altAction.effect,
        minutes: altAction.minutes,
      }
    : null;
  let alternative: OpportunityFitResult["alternative"] = null;

  /** 준비 1시간이 목표에 가까워지는 정도 */
  const efficiency = prepHours > 0 ? gapEffect / prepHours : gapEffect;
  /** 마감까지 낼 수 있는 시간. 마감을 모르면 0 (아래에서 마감 여부를 먼저 본다) */
  const availableHours = Math.max(0, daysUntilDeadline ?? 0) * HOURS_PER_DAY;

  if (daysUntilDeadline !== null && prepHours > availableHours) {
    // 시간이 물리적으로 모자란다. 적합도가 아무리 높아도 지금 시작하면 다른 준비를 밀어낸다.
    recommendation = "skip";
    alternative = alternativeAction;
    recommendationReason =
      daysUntilDeadline <= 0
        ? "지원 마감이 이미 지났습니다."
        : `마감까지 ${daysUntilDeadline}일(하루 ${HOURS_PER_DAY}시간이면 약 ${availableHours}시간)인데 준비에는 ${prepHours}시간이 필요합니다. 지금 시작하면 다른 준비를 밀어냅니다.`;
    breakdown.push({
      label: `마감까지 ${Math.max(0, daysUntilDeadline)}일 — 준비 시간이 모자람`,
      points: 0,
      type: "warn",
    });
    weaknesses.push("마감까지 남은 시간이 부족함");
  } else if (score >= 68 && gapEffect >= 0.8) {
    recommendation = "apply";
    recommendationReason = `적합도가 높고, 준비하면서 ${trainedGaps.join("·")} 부족한 부분도 함께 채울 수 있습니다.`;
  } else if (score >= 68 && efficiency >= MIN_EFFICIENCY) {
    recommendation = "apply";
    recommendationReason =
      "적합도가 높아 지금 역량으로 승부할 수 있는 기회입니다.";
  } else if (score >= 68 && prepHours < COSTLY_HOURS) {
    // 목표에 직접 도움이 되진 않지만 몇 시간이면 끝난다 — 말릴 이유가 없다
    recommendation = "apply";
    recommendationReason = `준비가 ${prepHours}시간이면 되고 적합도도 높습니다. 목표에 직접 도움이 크진 않지만 부담 없이 해볼 만합니다.`;
  } else if (score >= 68 && gapEffect < 0.3) {
    // 붙을 가능성은 높지만 시간은 많이 들고 목표에는 거의 기여하지 않는다
    // — 지원서에서 말한 "지원하지 않는 편이 낫다"의 대표 경우
    recommendation = "skip";
    alternative = alternativeAction;
    recommendationReason = `합격 가능성은 높지만, 준비에 드는 ${prepHours}시간이 목표에 가까워지는 데는 거의 기여하지 않습니다(+${gapEffect}). 지금은 다른 행동이 효과적입니다.`;
  } else if (score >= 68) {
    // 도움이 되긴 하나 시간이 많이 든다 — 급한 일이 없을 때만
    recommendation = "hold";
    recommendationReason = `적합도는 높지만 준비에 ${prepHours}시간이 들고 목표에 가까워지는 정도는 +${gapEffect}입니다. 더 급한 준비가 없을 때 지원하세요.`;
  } else if (score >= 52) {
    recommendation = "hold";
    recommendationReason = `약점(${weaknesses[0] ?? "근거 부족"})을 보강한 뒤 지원하면 훨씬 유리합니다.`;
  } else {
    recommendation = "skip";
    alternative = alternativeAction;
    recommendationReason = `예상 준비 시간 ${prepHours}시간 대비 목표에 가까워지는 정도가 +${gapEffect}로 낮습니다. 지금은 목표에 더 직접적인 행동이 효과적입니다.`;
  }

  return {
    score,
    breakdown,
    strengths,
    weaknesses,
    prepHours,
    gapEffect,
    recommendation,
    recommendationReason,
    alternative,
  };
}
