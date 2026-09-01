// Today's Career Mission 선정 (순수 함수 — 테스트 가능).
// "오늘 가장 커리어에 효과적인 행동"을 Gap 크기 × 효과 ÷ 시간 기준으로 고른다.

import type { GapItem } from "./gap";

export interface MissionCandidate {
  skill: string;
  title: string;
  reason: string;
  expectedEffect: number;
  expectedMinutes: number;
  /** 왜 이 행동을 추천했는가 */
  why: string;
}

/**
 * 이미 진행/완료/숨김 처리된 행동 제목을 제외하고
 * 효율(효과×Gap 가중치 ÷ 시간)이 가장 높은 행동을 고른다.
 */
export function pickMission(
  gaps: GapItem[],
  excludeTitles: Set<string>,
): MissionCandidate | null {
  let best: { candidate: MissionCandidate; efficiency: number } | null = null;

  for (const gap of gaps) {
    // 큰 Gap일수록 가중치 (1.0 ~ 2.0)
    const gapWeight = 1 + Math.min(1, gap.gap / 40);
    for (const action of gap.actions) {
      if (excludeTitles.has(action.title)) continue;
      const efficiency = (action.effect * gapWeight) / Math.max(0.5, action.minutes / 60);
      const candidate: MissionCandidate = {
        skill: gap.skill,
        title: action.title,
        reason: action.reason,
        expectedEffect: action.effect,
        expectedMinutes: action.minutes,
        why: `현재 목표 대비 ${gap.skill} 역량이 ${gap.gap}점 부족합니다 (${gap.current}/${gap.target}). ${action.reason}`,
      };
      if (!best || efficiency > best.efficiency) {
        best = { candidate, efficiency };
      }
    }
  }

  return best?.candidate ?? null;
}

/** 상위 N개의 추천 행동 목록 (Gap 페이지·로드맵 생성용) */
export function rankActions(
  gaps: GapItem[],
  excludeTitles: Set<string>,
  limit = 6,
): MissionCandidate[] {
  const all: Array<{ candidate: MissionCandidate; efficiency: number }> = [];
  for (const gap of gaps) {
    const gapWeight = 1 + Math.min(1, gap.gap / 40);
    for (const action of gap.actions) {
      if (excludeTitles.has(action.title)) continue;
      all.push({
        candidate: {
          skill: gap.skill,
          title: action.title,
          reason: action.reason,
          expectedEffect: action.effect,
          expectedMinutes: action.minutes,
          why: `${gap.skill} Gap ${gap.gap}점 (${gap.current}/${gap.target})`,
        },
        efficiency: (action.effect * gapWeight) / Math.max(0.5, action.minutes / 60),
      });
    }
  }
  return all
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, limit)
    .map((x) => x.candidate);
}
