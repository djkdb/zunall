// Career Gap 엔진 (순수 함수 — 테스트 가능).
// 목표 템플릿과 현재 스킬 점수를 비교해 부족한 부분과 추천 행동을 만든다.

import {
  GAP_ACTION_TEMPLATES,
  type GapActionTemplate,
  type RoleTemplate,
} from "@/lib/career-constants";
import type { SkillScoreDetail } from "@/services/score/skill";

export interface GapItem {
  skill: string;
  current: number;
  target: number;
  gap: number; // target - current (양수만)
  whyNeeded: string; // 이 스킬이 목표에 왜 필요한가
  whyLacking: string; // 왜 부족하다고 판단했는가 (근거)
  actions: GapActionTemplate[];
}

export function computeGaps(
  template: RoleTemplate,
  skillScores: SkillScoreDetail[],
): GapItem[] {
  const byName = new Map(skillScores.map((s) => [s.name, s]));
  const gaps: GapItem[] = [];

  for (const req of template.requirements) {
    const detail = byName.get(req.skill);
    const current = detail?.score ?? 0;
    const gap = req.target - current;
    if (gap <= 0) continue;

    const evidenceCount = detail?.evidenceCount ?? 0;
    const whyLacking =
      evidenceCount === 0
        ? `이 역량을 뒷받침하는 근거(Evidence)가 아직 없습니다.`
        : `연결된 근거가 ${evidenceCount}개뿐이라 목표 수준(${req.target})에 비해 검증이 부족합니다.`;

    gaps.push({
      skill: req.skill,
      current,
      target: req.target,
      gap,
      whyNeeded: req.why,
      whyLacking,
      actions: GAP_ACTION_TEMPLATES[req.skill] ?? [
        {
          title: `${req.skill} 관련 결과물 1개 만들기`,
          minutes: 180,
          effect: 3,
          reason: "실제 산출물이 가장 확실한 근거입니다.",
        },
      ],
    });
  }

  return gaps.sort((a, b) => b.gap - a.gap);
}
