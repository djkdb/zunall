/**
 * Documents vs answers: does what the candidate said in the interview match what they wrote
 * in the résumé / cover letter? Interviewers do this check in their heads ("서류에는 40%라고
 * 쓰셨는데요"); the sheet shows it so the candidate can fix the gap before a real interview.
 *
 * Deterministic and local: numbers with units and the candidate's role are compared, nothing
 * is sent anywhere. Only claims the interview actually got to are judged.
 */
import { documentClaims, type DocClaim, type DocSource } from "./documents";
import type { Documents } from "./schemas";
import { hasBatchim } from "./korean";

export type CheckStatus = "match" | "mismatch" | "unexplained";

export interface DocumentCheck {
  status: CheckStatus;
  source: DocSource;
  /** The phrase from the document. */
  claim: string;
  /** What the answer said about it, in one sentence for the sheet. */
  detail: string;
  /** 1-based position of the question in the interview where it came up. */
  questionNo: number;
}

export interface CheckTurn {
  question: string;
  answer: string;
  /** Index of the main question this turn belongs to (follow-ups share their main's index). */
  thread: number;
  /** 1-based position in the interview. */
  no: number;
  score: number | null;
}

const UNIT: [RegExp, string][] = [
  [/^(?:%|퍼센트|프로)/, "%"],
  [/^배/, "배"],
  [/^명/, "명"],
  [/^건/, "건"],
  [/^개월/, "개월"],
  [/^주/, "주"],
  [/^일/, "일"],
  [/^시간/, "시간"],
  [/^분/, "분"],
  [/^초/, "초"],
  [/^ms/i, "ms"],
  [/^억/, "억"],
  [/^만\s?원/, "만원"],
  [/^원/, "원"],
  [/^(?:점)/, "점"],
  [/^(?:위|등)/, "위"],
];

export interface Quantity {
  value: number;
  unit: string;
  text: string;
}

/** "1,200명", "40%", "1.2초", "3개월" → value + normalized unit. */
export function quantities(text: string): Quantity[] {
  const out: Quantity[] = [];
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s?([^\s\d.,]{1,3})/g)) {
    const rest = m[2];
    const unit = UNIT.find(([re]) => re.test(rest))?.[1];
    if (!unit) continue;
    out.push({ value: Number(m[1].replace(/,/g, "")), unit, text: `${m[1]}${unit}` });
  }
  return out;
}

/** "800명이라고" / "30%라고": the quoting particle that fits how the last quantity is read. */
const spokenUnit = (q: Quantity) => ({ "%": "퍼센트", ms: "밀리초" })[q.unit] ?? q.unit;
const rago = (qs: Quantity[]) => (hasBatchim(spokenUnit(qs[qs.length - 1])) ? "이라고" : "라고");
const DURATION = new Set(["개월", "주", "일", "시간"]);

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.05 * Math.max(a, b), 0.01);

/** "1.2초에서 0.7초로" → about a 42% change, to compare with a percentage on paper. */
function percentChange(qs: Quantity[]): { pct: number; from: Quantity; to: Quantity } | null {
  for (let i = 0; i + 1 < qs.length; i++) {
    const [a, b] = [qs[i], qs[i + 1]];
    if (a.unit !== b.unit || a.unit === "%" || !a.value) continue;
    return { pct: Math.round((Math.abs(a.value - b.value) / a.value) * 100), from: a, to: b };
  }
  return null;
}

const LEAD = /팀장|리더|주도|총괄|이끌|책임자|PM을?\s?맡/;
const MEMBER = /팀원으로|참여(?:만|했)|보조|서포트|도왔|도와\s?드|맡은\s?건\s?일부|제\s?역할은\s?작/;

function checkMetric(claim: DocClaim, answer: string): Pick<DocumentCheck, "status" | "detail"> | null {
  // The result ("1,200명", "40%") matters more than how long it took ("3개월 동안").
  const onPaper = quantities(claim.quote).sort((a, b) => Number(DURATION.has(a.unit)) - Number(DURATION.has(b.unit)));
  if (!onPaper.length) return null;
  const said = quantities(answer);
  for (const p of onPaper) {
    const same = said.filter((s) => s.unit === p.unit);
    if (same.some((s) => close(s.value, p.value))) return { status: "match", detail: `답변에서도 ${p.text}로 설명했습니다.` };
    if (same.length) return { status: "mismatch", detail: `서류에는 ${p.text}인데 답변에서는 ${same.map((s) => s.text).join(", ")}${rago(same)} 했습니다. 어느 쪽이 맞는지 정리해 두세요.` };
    if (p.unit === "%") {
      const change = percentChange(said);
      if (change && Math.abs(change.pct - p.value) <= 5) return { status: "match", detail: `답변의 ${change.from.text}에서 ${change.to.text}는 약 ${change.pct}% 변화로, 서류의 ${p.text}와 맞습니다.` };
      if (change) return { status: "mismatch", detail: `답변의 ${change.from.text}에서 ${change.to.text}는 약 ${change.pct}% 변화인데, 서류에는 ${p.text}로 적었습니다.` };
    }
  }
  const main = onPaper[0];
  return { status: "unexplained", detail: `서류에 쓴 ${main.text}${hasBatchim(spokenUnit(main)) ? "을" : "를"} 답변에서 숫자로 설명하지 않았습니다. 어떻게 측정했는지 한 문장으로 준비해 두세요.` };
}

function checkRole(claim: DocClaim, answer: string): Pick<DocumentCheck, "status" | "detail"> | null {
  if (!LEAD.test(claim.context ?? claim.quote)) return null;
  if (MEMBER.test(answer) && !LEAD.test(answer)) return { status: "mismatch", detail: "서류에는 이끈 역할로 적었는데, 답변에서는 참여하거나 도운 역할로 말했습니다. 실제 역할에 맞게 서류나 답변을 맞추세요." };
  if (LEAD.test(answer)) return { status: "match", detail: "답변에서도 본인이 이끈 역할이라고 일관되게 말했습니다." };
  return null;
}

/**
 * One row per document claim the interview got to: asked about directly (a question quoting it),
 * or a number from the documents that came up in an answer.
 */
export function checkDocuments(docs: Documents, turns: CheckTurn[]): DocumentCheck[] {
  const out: DocumentCheck[] = [];
  const answered = turns.filter((t) => t.answer.trim());
  for (const claim of documentClaims(docs)) {
    // The thread whose main question quoted this claim, with its follow-ups.
    const asked = answered.find((t) => t.question.includes(claim.quote));
    const thread = asked ? answered.filter((t) => t.thread === asked.thread) : [];
    const threadText = thread.map((t) => t.answer).join("\n");
    const base = { source: claim.source, claim: claim.quote };

    if (asked) {
      const result = checkMetric(claim, threadText) ?? checkRole(claim, threadText);
      if (result) {
        out.push({ ...base, ...result, questionNo: asked.no });
        continue;
      }
      const best = Math.max(...thread.map((t) => t.score ?? 0));
      if (best < 50) out.push({ ...base, status: "unexplained", detail: "서류에 쓴 내용을 묻는 질문에 구체적인 사례로 답하지 못했습니다. 서류의 이 문장을 뒷받침할 경험을 하나 정리해 두세요.", questionNo: asked.no });
      else out.push({ ...base, status: "match", detail: "서류에 쓴 내용을 답변에서 구체적으로 설명했습니다.", questionNo: asked.no });
      continue;
    }

    // Not asked, but the same kind of number came up elsewhere with a different value.
    const onPaper = quantities(claim.quote).filter((q) => q.unit !== "일" && q.unit !== "주");
    for (const t of answered) {
      const result = onPaper.length ? checkMetric(claim, t.answer) : null;
      if (result?.status === "mismatch" && sharesTopic(claim.quote, t.answer)) {
        out.push({ ...base, ...result, questionNo: t.no });
        break;
      }
    }
  }
  return out.sort((a, b) => order(a.status) - order(b.status) || a.questionNo - b.questionNo);
}

const order = (s: CheckStatus) => ({ mismatch: 0, unexplained: 1, match: 2 })[s];

/** Two texts about the same thing: they share a noun-like word of 2+ syllables besides the number. */
function sharesTopic(a: string, b: string): boolean {
  const words = (t: string) => new Set((t.match(/[가-힣A-Za-z]{2,}/g) ?? []).map((w) => w.replace(/(?:을|를|이|가|은|는|의|에|로|으로|에서|과|와)$/, "")).filter((w) => w.length >= 2));
  const wb = words(b);
  return [...words(a)].some((w) => wb.has(w) && !/^(?:저는|제가|했습니다|있습니다|합니다)$/.test(w));
}
