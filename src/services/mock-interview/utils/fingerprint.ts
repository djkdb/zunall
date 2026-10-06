/**
 * Question fingerprinting to stop the interviewer from repeating itself.
 * Lexical (character bigrams — works for Korean and English) plus semantic
 * matching, so a reworded version of an earlier question also counts as a repeat.
 */
import { isNearDuplicate, lexicalSimilarity } from "../shared/similarity";

export { bigrams } from "../shared/similarity";

/** Character-bigram Jaccard similarity (0–1). */
export const similarity = lexicalSimilarity;

export const DUPLICATE_THRESHOLD = 0.6;

export function isDuplicateQuestion(candidate: string, asked: string[]): boolean {
  return asked.some((q) => isNearDuplicate(candidate, q));
}
