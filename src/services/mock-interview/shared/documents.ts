/**
 * The candidate's own résumé (이력서) and cover letter (자기소개서), when they choose a
 * document-based interview.
 *
 * - `redactPersonalInfo` runs in the browser before anything is sent or stored: e-mail
 *   addresses, phone numbers, resident registration numbers and URLs are masked.
 * - `documentClaims` picks the sentences an interviewer would actually ask about (numbers,
 *   problems solved, roles taken, motivation…) so the mock interviewer can question them.
 */
import { josa } from "./korean";
import { contentTerms } from "./similarity";
import type { Documents, Language, QuestionType } from "./schemas";

const PII: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[이메일]"],
  [/\b\d{6}\s?-\s?[1-8]\d{6}\b/g, "[주민번호]"],
  [/(?:\+?82[-\s]?)?\(?0\d{1,2}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, "[전화번호]"],
  [/https?:\/\/\S+|www\.\S+/gi, "[링크]"],
];

/** Masks contact details and ID numbers. Names and addresses are left to the candidate (see the notice). */
export function redactPersonalInfo(text: string): string {
  return PII.reduce((t, [re, mask]) => t.replace(re, mask), text);
}

export const hasDocuments = (d: Documents | undefined | null): d is Documents => Boolean(d && (d.resume.trim() || d.coverLetter.trim()));

export type DocSource = "resume" | "coverLetter";
export type ClaimKind = "metric" | "problem" | "conflict" | "lead" | "project" | "skill" | "cert" | "strength" | "learning" | "motivation";

export interface DocClaim {
  kind: ClaimKind;
  /** Claims from one sentence are one story — only the most askable is kept. */
  story?: string;
  source: DocSource;
  /** A short phrase copied from the document (what the interviewer quotes). */
  quote: string;
  /** The whole line or sentence it came from, when the quote is shorter (e.g. a résumé line with the role). */
  context?: string;
}

const KIND_TYPE: Record<ClaimKind, QuestionType> = {
  metric: "result",
  problem: "deep_dive",
  conflict: "behavioral",
  lead: "deep_dive",
  project: "deep_dive",
  skill: "role_specific",
  cert: "role_specific",
  strength: "behavioral",
  learning: "reflection",
  motivation: "motivation",
};

/** Most-asked first: interviewers verify numbers and problems before motivation. */
const DETECTORS: { kind: ClaimKind; re: RegExp }[] = [
  { kind: "metric", re: /\d[\d,.]*\s?(?:%|퍼센트|배|명|건|개사|만\s?원|억|원|시간|분|초|ms|일|주|개월|위|점|회|만|천)/ },
  { kind: "conflict", re: /갈등|의견\s?(?:차이|충돌|대립)|설득/ },
  { kind: "problem", re: /문제|어려움|어려웠|실패|장애|오류|버그|위기|한계|극복|해결|개선|줄였|낮췄|높였|단축/ },
  { kind: "lead", re: /팀장|리더|주도|총괄|이끌|맡아|기획부터|책임/ },
  { kind: "strength", re: /강점|장점|저의\s?무기|자신\s?있/ },
  { kind: "learning", re: /배웠|배운|깨달|성장|교훈/ },
  { kind: "motivation", re: /지원(?:하게|했|합니다|동기)|입사|공감|관심을\s?(?:갖|가지)|계기|비전|목표/ },
];

/** Splits text into sentences, then into clauses at connective endings (each tagged with its sentence). */
function clauses(text: string): { sentence: number; text: string }[] {
  return text
    .split(/(?<=[.!?。])\s+|(?<=다\.)|\n+/)
    .flatMap((s, sentence) =>
      s.split(/(?<=(?:하여|해서|했고|하고|하며|했으며|었고|았고|였고|는데|지만|으며|면서|였으며)),?\s+|,\s+/).map((c) => ({ sentence, text: c })),
    )
    .map((c) => ({ ...c, text: c.text.replace(/^(?:[-•·▪■◦*]|\d{1,2}[.)])\s*/, "").replace(/[.。]+$/, "").trim() }))
    .filter((c) => c.text.length >= 6);
}

/** A quotable phrase: whole clause if short, else a window around the match snapped to spaces. */
function quotable(clause: string, re: RegExp, max = 42): string {
  if (clause.length <= max) return clause;
  const m = re.exec(clause);
  const at = m ? m.index : 0;
  let start = Math.max(0, at - 16);
  let end = Math.min(clause.length, start + max);
  while (start > 0 && !/\s/.test(clause[start - 1])) start--;
  while (end < clause.length && !/\s/.test(clause[end])) end++;
  return clause.slice(start, end).trim();
}

/** Résumé lines: "기술: React, TypeScript" / "자격증: 정보처리기사" / "프로젝트: … (2024.03~2024.08)". */
function resumeLines(resume: string): DocClaim[] {
  const out: DocClaim[] = [];
  for (const raw of resume.split(/\n+/)) {
    const line = raw.replace(/^[-•·▪■◦*\s]+/, "").trim();
    if (line.length < 3) continue;
    const label = /^([^:：]{1,12})[:：]\s*(.+)$/.exec(line);
    const head = label?.[1] ?? "";
    const body = (label?.[2] ?? line).trim();
    if (/기술|스택|skill|툴|tool|역량|활용/i.test(head)) {
      for (const s of body.split(/[,/·|]\s*/).map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 24).slice(0, 3)) out.push({ kind: "skill", source: "resume", quote: s });
    } else if (/자격|certif|license/i.test(head)) {
      for (const s of body.split(/[,/·|]\s*/).map((x) => x.replace(/\(.*?\)/g, "").replace(/\s?자격증$/, "").trim()).filter((x) => x.length >= 2 && x.length <= 24).slice(0, 2)) out.push({ kind: "cert", source: "resume", quote: s });
    } else if (/프로젝트|경력|경험|인턴|활동|근무|project|experience|intern/i.test(head) || /\d{4}[.\-/]\d{1,2}\s?[~–-]/.test(body)) {
      const title = body.split(/\s[-–|]\s/)[0].replace(/\(?\d{4}[.\-/]\d{1,2}.*?(?:\)|$)/g, "").replace(/\s{2,}/g, " ").replace(/[-–,]\s*$/, "").trim();
      if (title.length >= 4) out.push({ kind: "project", source: "resume", quote: quotable(title, /./, 40), context: line });
    }
  }
  return out;
}

/**
 * The claims worth asking about, most interview-worthy first, alternating résumé and cover
 * letter, without repeating the same phrase.
 */
export function documentClaims(docs: Documents): DocClaim[] {
  const found: DocClaim[] = [];
  // Labelled résumé lines ("기술: …") are read by resumeLines; sentences are read here.
  const resumeProse = docs.resume.split(/\n+/).filter((l) => !/^[-•·▪■◦*\s]*[^:：]{1,12}[:：]/.test(l)).join("\n");
  for (const [source, text] of [["coverLetter", docs.coverLetter], ["resume", resumeProse]] as const) {
    for (const { sentence, text: c } of clauses(text)) {
      const d = DETECTORS.find((x) => x.re.test(c));
      // "지원하게 되었습니다" alone says nothing worth asking about.
      if (d && c.replace(/\s+/g, "").length >= 12) found.push({ kind: d.kind, source, quote: quotable(c, d.re), story: `${source}:${sentence}` });
    }
  }
  found.push(...resumeLines(docs.resume));
  const rank = (k: ClaimKind) => ["metric", "problem", "project", "lead", "conflict", "skill", "strength", "learning", "motivation", "cert"].indexOf(k);
  const seen = new Set<string>();
  // One question per story: a claim sharing two content words with an earlier one is the same story.
  const stories: Set<string>[] = [];
  const sameStory = (q: string) => {
    const words = contentTerms(q).words;
    if ([...stories].some((s) => [...words].filter((w) => w.length >= 2 && s.has(w)).length >= 2)) return true;
    stories.push(words);
    return false;
  };
  return found
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c.kind) - rank(b.c.kind) || a.i - b.i)
    .map(({ c }) => c)
    .filter((c) => {
      const key = c.quote.replace(/\s+/g, "");
      if (seen.has(key) || [...seen].some((s) => s.includes(key) || key.includes(s))) return false;
      if (c.story && seen.has(c.story)) return false;
      if (c.story) seen.add(c.story);
      if (c.kind !== "skill" && c.kind !== "cert" && sameStory(c.quote)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

const WHERE = {
  ko: { resume: "이력서에", coverLetter: "자기소개서에" },
  en: { resume: "In your résumé you wrote", coverLetter: "In your cover letter you wrote" },
} as const;

/** The question an interviewer would ask about a claim (quoting the candidate's own words). */
export function documentQuestion(claim: DocClaim, lang: Language): { question: string; type: QuestionType; intent: string } {
  const q = claim.quote;
  const type = KIND_TYPE[claim.kind];
  if (lang === "en") {
    const lead = `${WHERE.en[claim.source]} "${q}".`;
    const ask: Record<ClaimKind, string> = {
      metric: "How did you measure that, and which part of it was your own contribution?",
      problem: "How did you find the cause, and why did you choose that fix?",
      conflict: "What was the other side's position, and how did you reach agreement?",
      lead: "Tell me about one decision you made yourself in that role.",
      project: "What was your part in it, and what was the hardest moment?",
      skill: "In what situation did you actually use it, and how?",
      cert: "What from preparing for it can you use in this job right away?",
      strength: "Give me one real moment where that strength showed.",
      learning: "How did that lesson change what you actually did afterwards?",
      motivation: "What concrete experience made you think that?",
    };
    return { question: `${lead} ${ask[claim.kind]}`, type, intent: "Verify a claim from the submitted documents against what the candidate can explain." };
  }
  // A whole sentence is quoted as said ("'…줄였습니다'라고 쓰셨는데"), a clause as a passage.
  const doc = claim.source === "resume" ? "이력서" : "자기소개서";
  const said = /[다요]$/.test(q) ? `${WHERE.ko[claim.source]} '${q}'라고 쓰셨는데,` : `${doc}에서 '${q}' 부분이 눈에 띄었는데요,`;
  const ko: Record<ClaimKind, string> = {
    metric: `${said} 그 수치는 어떻게 측정하셨고, 그중 본인 기여는 어디까지였나요?`,
    problem: `${said} 원인은 어떻게 찾으셨고, 왜 그 방법을 선택하셨나요?`,
    conflict: `${said} 상대방은 어떤 입장이었고, 어떻게 합의에 이르셨나요?`,
    lead: `${said} 그 과정에서 본인이 직접 내린 결정 하나를 구체적으로 말씀해 주세요.`,
    project: `이력서의 '${q}' 경험에서 맡으신 역할과 가장 어려웠던 순간을 말씀해 주세요.`,
    skill: `이력서에 ${q}${josa(q, "을/를")} 적어 주셨는데, 실제로 어떤 상황에서 어떻게 써 보셨나요?`,
    cert: `이력서에 ${q} 자격증이 있던데, 준비하면서 익힌 것 중 이 직무에 바로 쓸 수 있는 건 무엇인가요?`,
    strength: `${said} 그 강점이 실제로 드러난 장면을 하나 들어 주시겠어요?`,
    learning: `${said} 그 배움이 이후 행동을 실제로 어떻게 바꿨나요?`,
    motivation: `${said} 그렇게 생각하게 된 구체적인 경험이 있나요?`,
  };
  return { question: ko[claim.kind], type, intent: "제출한 서류의 내용을 본인이 실제로 설명할 수 있는지 검증합니다." };
}
