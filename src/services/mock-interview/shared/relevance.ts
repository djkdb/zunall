/**
 * Role relevance: how well a question fits a role, 0–1.
 *
 *   ≥ 0.9 strong · ≥ 0.7 usable · ≥ 0.5 general · < 0.5 reject
 *
 * Used by the data pipeline before questions enter the bank, and by tests that
 * make sure an accountant is never asked about React and a nurse never about CI/CD.
 * Tech terms are not banned outright — a marketer may well use SQL — they only count
 * against a question when they're foreign to the role's own vocabulary.
 */
import type { Archetype, QuestionType } from "./schemas";

const TECH_ASCII = /\b(?:React|Vue|Angular|Next\.?js|Node\.?js|API|REST|GraphQL|Docker|Kubernetes|k8s|CI\/CD|TCP\/IP|HTTP|JavaScript|TypeScript|Java|Python|Kotlin|Swift|SQL|NoSQL|Redis|Kafka|AWS|GCP|Azure|DevOps|Git|OS|Linux|JVM|MSA|DB)\b/gi;
const TECH_KO = /프론트엔드|백엔드|코딩|프로그래밍|알고리즘|자료구조|데이터베이스|쿼리|서버|배포\s?파이프라인|운영체제|컴파일|리팩터링|코드\s?리뷰|멀티스레드|트랜잭션/g;

/** Archetypes whose work is software/data: tech vocabulary is native to them. */
const TECH_NATIVE = new Set<Archetype>(["tech_dev", "data_analytic"]);

/** Types that fit any role by nature (the question is about the person, not the job). */
const GENERIC_TYPES = new Set<QuestionType>(["opening", "motivation", "behavioral", "reflection", "ethics", "communication", "leadership", "challenge"]);

export function techTermsIn(text: string): string[] {
  return [...(text.match(TECH_ASCII) ?? []), ...(text.match(TECH_KO) ?? [])];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** Vocabulary of a role/family/domain: its skills, keywords, topics and names, as phrases and words. */
export function buildLexicon(parts: string[]): string[] {
  const out = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    const phrase = norm(p);
    if (phrase.length >= 2) out.add(phrase);
    for (const w of p.split(/[\s·,/()·&+]+/)) {
      const t = norm(w).replace(/(?:을|를|이|가|은|는|의|에|과|와|및|관리|업무|능력|역량)$/u, "");
      if (t.length >= 2) out.add(t);
    }
  }
  return [...out];
}

export interface Relevance {
  score: number;
  hits: string[];
  foreign: string[];
}

export function roleRelevance(text: string, type: QuestionType, lexicon: string[], archetype: Archetype): Relevance {
  const t = norm(text);
  const hits = lexicon.filter((k) => t.includes(k));
  const lex = new Set(lexicon);
  const foreign = TECH_NATIVE.has(archetype) ? [] : techTermsIn(text).filter((w) => !lex.has(norm(w)));
  let score = GENERIC_TYPES.has(type) ? 0.6 : 0.55;
  if (hits.length >= 1) score += 0.3;
  if (hits.length >= 2) score += 0.1;
  if (foreign.length) score -= 0.6;
  return { score: Math.max(0, Math.min(1, Math.round(score * 100) / 100)), hits, foreign };
}

export function relevanceBand(score: number): "strong" | "usable" | "general" | "reject" {
  return score >= 0.9 ? "strong" : score >= 0.7 ? "usable" : score >= 0.5 ? "general" : "reject";
}
