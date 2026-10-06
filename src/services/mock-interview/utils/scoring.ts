import { CATEGORY_KEYS, type AnswerAnalysis, type CategoryKey } from "../shared/schemas";
import { clampScore } from "../shared/sanitize";
import type { CategoryScores, InterviewQuestion } from "../types";

const WEIGHTS: Record<CategoryKey, number> = {
  relevance: 0.2,
  logic: 0.15,
  specificity: 0.2,
  structure: 0.15,
  communication: 0.15,
  confidence: 0.15,
};

/** Single answer score = weighted mean of its category scores. */
export function answerScore(a: AnswerAnalysis): number {
  return clampScore(CATEGORY_KEYS.reduce((sum, k) => sum + a.scores[k].score * WEIGHTS[k], 0));
}

export function answered(questions: InterviewQuestion[]): InterviewQuestion[] {
  return questions.filter((q) => q.feedback && q.answer);
}

export function categoryAverages(questions: InterviewQuestion[]): CategoryScores | null {
  const done = answered(questions);
  if (!done.length) return null;
  const out = {} as CategoryScores;
  for (const k of CATEGORY_KEYS) {
    out[k] = clampScore(done.reduce((s, q) => s + q.feedback!.scores[k].score, 0) / done.length);
  }
  return out;
}

export function overallScore(questions: InterviewQuestion[]): number | null {
  const done = answered(questions);
  if (!done.length) return null;
  return clampScore(done.reduce((s, q) => s + (q.score ?? 0), 0) / done.length);
}

export function strongestAndWeakest(scores: CategoryScores): { strongest: CategoryKey; weakest: CategoryKey } {
  const sorted = [...CATEGORY_KEYS].sort((a, b) => scores[b] - scores[a]);
  return { strongest: sorted[0], weakest: sorted[sorted.length - 1] };
}

export type ScoreTone = "good" | "ok" | "warn" | "low";
export function scoreTone(score: number): ScoreTone {
  if (score >= 80) return "good";
  if (score >= 65) return "ok";
  if (score >= 50) return "warn";
  return "low";
}
