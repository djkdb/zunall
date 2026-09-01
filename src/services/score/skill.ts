// 스킬 점수 계산 (순수 함수 — 테스트 가능).
// 원칙: 점수는 항상 근거(contributions)와 함께 반환한다. 근거 없는 점수를 만들지 않는다.

import {
  EVIDENCE_WEIGHTS,
  SKILL_CATALOG,
  type EvidenceKind,
  type SkillCategory,
} from "@/lib/career-constants";

export interface SkillEvidenceInput {
  id: string;
  kind: string;
  title: string;
  skills: string[]; // 이 근거가 뒷받침하는 스킬명 목록
}

export interface SkillInput {
  name: string;
  category: string;
  selfScore: number | null;
}

export interface SkillContribution {
  label: string;
  points: number;
  evidenceId?: string;
}

export interface SkillScoreDetail {
  name: string;
  category: SkillCategory;
  score: number; // 0~100
  confidence: number; // 0~1
  evidenceCount: number;
  contributions: SkillContribution[];
}

function categoryOf(name: string, declared?: string): SkillCategory {
  if (declared === "tech" || declared === "domain" || declared === "soft") return declared;
  const catalog = SKILL_CATALOG.find((s) => s.name === name);
  return catalog?.category ?? "tech";
}

/**
 * 근거 포인트 → 0~100 점수 (수확 체감).
 * 포인트 45 ≈ 63점, 90 ≈ 86점, 135 ≈ 95점.
 */
export function pointsToScore(points: number): number {
  if (points <= 0) return 0;
  return Math.round(100 * (1 - Math.exp(-points / 45)));
}

/**
 * 사용자 스킬 점수 계산.
 * 대상 스킬 = 사용자가 등록한 스킬 ∪ 근거에 연결된 스킬.
 */
export function computeSkillScores(
  skills: SkillInput[],
  evidence: SkillEvidenceInput[],
): SkillScoreDetail[] {
  const names = new Map<string, SkillInput>();
  for (const skill of skills) {
    names.set(skill.name, skill);
  }
  for (const ev of evidence) {
    for (const name of ev.skills) {
      if (!names.has(name)) names.set(name, { name, category: categoryOf(name), selfScore: null });
    }
  }

  const results: SkillScoreDetail[] = [];
  for (const [name, skill] of names) {
    const related = evidence.filter((e) => e.skills.includes(name));
    const contributions: SkillContribution[] = [];
    let points = 0;

    for (const ev of related) {
      const weight = EVIDENCE_WEIGHTS[(ev.kind as EvidenceKind) in EVIDENCE_WEIGHTS ? (ev.kind as EvidenceKind) : "etc"];
      points += weight;
      contributions.push({ label: ev.title, points: weight, evidenceId: ev.id });
    }

    // 자가 평가는 낮은 가중치의 참고 근거로만 반영 (최대 12포인트)
    if (skill.selfScore !== null && skill.selfScore > 0) {
      const selfPoints = Math.round(Math.min(12, skill.selfScore * 0.12));
      points += selfPoints;
      contributions.push({ label: "자가 평가 (참고)", points: selfPoints });
    }

    const confidence = Math.min(1, related.length / 5 + (skill.selfScore !== null ? 0.05 : 0));

    results.push({
      name,
      category: categoryOf(name, skill.category),
      score: pointsToScore(points),
      confidence: Math.round(confidence * 100) / 100,
      evidenceCount: related.length,
      contributions: contributions.sort((a, b) => b.points - a.points),
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
