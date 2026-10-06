/**
 * Post-processing that makes AI output safe to render:
 *  - clamps scores into 0-100,
 *  - drops "evidence" quotes that do not literally appear in the answer
 *    (hallucination guard — analysis must be grounded in what was said),
 *  - trims list lengths and whitespace.
 */
import {
  CATEGORY_KEYS,
  type AnswerAnalysis,
  type FinalReport,
  type FollowUpDecision,
  type GeneratedQuestion,
} from "./schemas";

export const clampScore = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[\s"'“”‘’`.,!?…·:;()[\]{}-]+/g, " ")
    .trim();

/** True when `quote` appears (whitespace/punctuation-insensitively) in `source`. */
export function isGroundedQuote(quote: string, source: string): boolean {
  const q = normalize(quote);
  if (q.length < 2) return false;
  return normalize(source).includes(q);
}

/** Whitespace, length, and the em/en dashes models reach for (a spoken line never has them). */
const tidy = (s: string, max = 400): string =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*([,.?!])/g, "$1")
    .replace(/,\s([은는이가을를의에도])(?=\s)/g, "$1")
    .trim()
    .slice(0, max);
const tidyList = (xs: string[], maxItems: number, maxLen = 240): string[] =>
  xs.map((x) => tidy(x, maxLen)).filter(Boolean).slice(0, maxItems);

export function sanitizeAnalysis(a: AnswerAnalysis, answer: string): AnswerAnalysis {
  const scores = { ...a.scores };
  for (const key of CATEGORY_KEYS) {
    scores[key] = { score: clampScore(a.scores[key].score), reason: tidy(a.scores[key].reason, 240) };
  }
  return {
    ...a,
    scores,
    strength: tidy(a.strength),
    improve: tidy(a.improve),
    reaction: tidy(a.reaction, 220),
    betterAnswer: {
      problem: tidy(a.betterAnswer.problem, 240),
      suggestion: tidy(a.betterAnswer.suggestion, 300),
      example: tidy(a.betterAnswer.example, 400),
    },
    roleSignal: a.roleSignal && a.roleSignal.label.trim() && a.roleSignal.note.trim() ? { label: tidy(a.roleSignal.label, 40), note: tidy(a.roleSignal.note, 240) } : null,
    evidence: tidyList(a.evidence, 3, 160).filter((q) => isGroundedQuote(q, answer)),
    notFound: tidyList(a.notFound, 3),
  };
}

export function sanitizeQuestion(q: GeneratedQuestion): GeneratedQuestion {
  return { ...q, question: tidy(q.question, 300), intent: tidy(q.intent, 200) };
}

export function sanitizeFollowUp(f: FollowUpDecision, answer: string): FollowUpDecision {
  const anchor = tidy(f.anchor, 80);
  const question = tidy(f.question, 300);
  return {
    ...f,
    needed: f.needed && question.length > 0,
    question,
    reason: tidy(f.reason, 220),
    anchor: anchor && isGroundedQuote(anchor, answer) ? anchor : "",
  };
}

export function sanitizeReport(r: FinalReport): FinalReport {
  return {
    headline: tidy(r.headline, 160),
    topFeedback: tidy(r.topFeedback, 320),
    strengths: tidyList(r.strengths, 4),
    improvements: tidyList(r.improvements, 4),
    nextSteps: tidyList(r.nextSteps, 4),
    closingRemark: tidy(r.closingRemark, 220),
  };
}
