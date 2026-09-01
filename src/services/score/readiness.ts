// Career Readiness 점수 (순수 함수 — 테스트 가능).
// "합격 확률"이 아니라 목표 대비 준비도를 설명 가능한 항목 합산으로 계산한다.

import type { RoleTemplate } from "@/lib/career-constants";
import type { SkillScoreDetail } from "./skill";

export interface ReadinessInput {
  template: RoleTemplate;
  skillScores: SkillScoreDetail[];
  evidenceCount: number;
  activityStats: { total: number; finished: number; won: number };
  profile: {
    hasGoal: boolean;
    hasHeadline: boolean;
    hasSummary: boolean;
    skillCount: number;
  };
}

export interface ReadinessItem {
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface ReadinessResult {
  score: number; // 0~100
  items: ReadinessItem[];
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const { template, skillScores, evidenceCount, activityStats, profile } = input;
  const scoreByName = new Map(skillScores.map((s) => [s.name, s.score]));

  // 1) 목표 스킬 충족도 (55점): 템플릿 요구 스킬 대비 현재 수준
  const fits = template.requirements.map((req) => {
    const current = scoreByName.get(req.skill) ?? 0;
    return clamp(current / req.target, 0, 1);
  });
  const skillFitRatio = fits.length > 0 ? fits.reduce((a, b) => a + b, 0) / fits.length : 0;
  const metCount = template.requirements.filter(
    (req) => (scoreByName.get(req.skill) ?? 0) >= req.target,
  ).length;

  // 2) 경험 (15점): 활동 참여·완료·수상
  const expRaw = activityStats.total + activityStats.finished * 2 + activityStats.won * 3;
  const expRatio = clamp(expRaw / 14, 0, 1);

  // 3) 근거 (15점): 검증 가능한 evidence 수
  const evidenceRatio = clamp(evidenceCount / 12, 0, 1);

  // 4) 준비 기본기 (15점): 목표·프로필·스킬 등록 여부
  const basics =
    (profile.hasGoal ? 1 : 0) +
    (profile.hasHeadline ? 1 : 0) +
    (profile.hasSummary ? 1 : 0) +
    (profile.skillCount >= 3 ? 1 : 0);
  const basicsRatio = basics / 4;

  const items: ReadinessItem[] = [
    {
      label: "목표 스킬 충족도",
      points: Math.round(skillFitRatio * 55),
      max: 55,
      detail: `요구 스킬 ${template.requirements.length}개 중 ${metCount}개가 목표 수준 도달`,
    },
    {
      label: "실전 경험",
      points: Math.round(expRatio * 15),
      max: 15,
      detail: `활동 ${activityStats.total}개 · 완료 ${activityStats.finished}개 · 수상 ${activityStats.won}회`,
    },
    {
      label: "검증 가능한 근거",
      points: Math.round(evidenceRatio * 15),
      max: 15,
      detail: `등록된 근거(Evidence) ${evidenceCount}개`,
    },
    {
      label: "준비 기본기",
      points: Math.round(basicsRatio * 15),
      max: 15,
      detail: `목표 설정${profile.hasGoal ? " ✓" : " ✗"} · 프로필${profile.hasHeadline && profile.hasSummary ? " ✓" : " △"} · 스킬 ${profile.skillCount}개`,
    },
  ];

  const score = clamp(
    items.reduce((sum, item) => sum + item.points, 0),
    0,
    100,
  );

  return { score, items };
}
