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

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function computeOpportunityFit(params: {
  requirements: OpportunityRequirementsInput;
  skillScores: SkillScoreDetail[];
  gaps: GapItem[];
  template: RoleTemplate;
}): OpportunityFitResult {
  const { requirements, skillScores, gaps, template } = params;
  const scoreByName = new Map(skillScores.map((s) => [s.name, s]));
  const templateSkills = new Set(template.requirements.map((r) => r.skill));

  const breakdown: FitBreakdownItem[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 40; // 기본점

  // 1) 요구 역량 매치 — 요구 역량이 적을수록 개별 역량의 비중이 크다
  const requiredList = requirements.requiredSkills.slice(0, 6);
  const perSkillPoints = requiredList.length <= 2 ? 14 : requiredList.length <= 4 ? 10 : 8;
  let missingRequired = 0;
  for (const skillName of requiredList) {
    const detail = scoreByName.get(skillName);
    const current = detail?.score ?? 0;
    if (current >= 60) {
      score += perSkillPoints;
      breakdown.push({ label: `요구 역량 충족: ${skillName} (${current})`, points: perSkillPoints, type: "plus" });
      strengths.push(`${skillName} 역량이 강함 (근거 ${detail?.evidenceCount ?? 0}개)`);
    } else if (current >= 35) {
      const pts = Math.round(perSkillPoints / 2);
      score += pts;
      breakdown.push({ label: `요구 역량 일부 충족: ${skillName} (${current})`, points: pts, type: "plus" });
      weaknesses.push(`${skillName} 근거가 더 필요함 (현재 ${current})`);
    } else {
      missingRequired++;
      const pts = -6;
      score += pts;
      breakdown.push({ label: `요구 역량 부족: ${skillName} (${current})`, points: pts, type: "warn" });
      weaknesses.push(`${skillName} 경험이 거의 없음`);
    }
  }

  // 2) 우대 역량 매치
  for (const skillName of requirements.preferredSkills.slice(0, 4)) {
    const current = scoreByName.get(skillName)?.score ?? 0;
    if (current >= 55) {
      const pts = 3;
      score += pts;
      breakdown.push({ label: `우대 사항 보유: ${skillName}`, points: pts, type: "plus" });
      strengths.push(`우대 역량 ${skillName} 보유`);
    }
  }

  // 3) 목표 정렬: 이 기회가 요구하는 역량이 내 목표 직무 역량과 겹치는가
  const aligned = requirements.requiredSkills.filter((s) => templateSkills.has(s));
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
    breakdown.push({ label: "현재 목표 직무와 요구 역량이 거의 겹치지 않음", points: pts, type: "warn" });
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
  let recommendation: OpportunityFitResult["recommendation"];
  let recommendationReason: string;
  let alternative: OpportunityFitResult["alternative"] = null;

  const topGap = gaps[0];
  if (score >= 68 && gapEffect >= 0.8) {
    recommendation = "apply";
    recommendationReason = `적합도가 높고, 준비 과정에서 ${trainedGaps.join("·")} Gap을 함께 줄일 수 있습니다.`;
  } else if (score >= 68) {
    recommendation = "apply";
    recommendationReason = "적합도가 높아 현재 역량으로 승부할 수 있는 기회입니다.";
  } else if (score >= 52) {
    recommendation = "hold";
    recommendationReason = `약점(${weaknesses[0] ?? "근거 부족"})을 보강한 뒤 지원하면 훨씬 유리합니다.`;
  } else {
    recommendation = "skip";
    const altAction = topGap?.actions[0];
    recommendationReason = `예상 준비 시간 ${prepHours}시간 대비 Career Gap 감소 효과가 +${gapEffect}로 낮습니다. 지금은 목표에 더 직접적인 행동이 효과적입니다.`;
    if (altAction) {
      alternative = {
        title: altAction.title,
        effect: altAction.effect,
        minutes: altAction.minutes,
      };
    }
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
