// Today's Career Mission 선정 (순수 함수 — 테스트 가능).
// "오늘 가장 커리어에 효과적인 행동"을 격차 × 효과 × 직무 핵심도 ÷ 시간 기준으로 고른다.

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
 * 행동의 우선순위 점수.
 *
 * 효과 × 격차 가중치 ÷ 시간 만 보면 짧은 일이 늘 이긴다. 디자이너에게
 * 핵심 역량(디자인, 목표 85)보다 부수 역량(Frontend, 목표 45)의 1시간짜리
 * 일이 먼저 추천됐다. 직무가 그 역량을 얼마나 중요하게 보는지(목표 수준)를
 * 곱해, 핵심 역량의 일이 밀리지 않게 한다. 0.5~1.0 범위라 짧은 일의 이점은 남는다.
 */
function priorityOf(gap: GapItem, action: GapItem["actions"][number], maxTarget: number): number {
  const gapWeight = 1 + Math.min(1, gap.gap / 40); // 큰 격차일수록 (1.0 ~ 2.0)
  const importance = 0.5 + 0.5 * (gap.target / Math.max(1, maxTarget)); // 핵심 역량일수록 (0.5 ~ 1.0)
  return (action.effect * gapWeight * importance) / Math.max(0.5, action.minutes / 60);
}

const maxTargetOf = (gaps: GapItem[]) => Math.max(1, ...gaps.map((g) => g.target));

/**
 * 이미 진행/완료/숨김 처리된 행동 제목을 제외하고
 * 우선순위가 가장 높은 행동을 고른다.
 */
export function pickMission(
  gaps: GapItem[],
  excludeTitles: Set<string>,
): MissionCandidate | null {
  let best: { candidate: MissionCandidate; efficiency: number } | null = null;
  const maxTarget = maxTargetOf(gaps);

  for (const gap of gaps) {
    for (const action of gap.actions) {
      if (excludeTitles.has(action.title)) continue;
      const efficiency = priorityOf(gap, action, maxTarget);
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
  const maxTarget = maxTargetOf(gaps);
  for (const gap of gaps) {
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
        efficiency: priorityOf(gap, action, maxTarget),
      });
    }
  }
  return all
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, limit)
    .map((x) => x.candidate);
}
