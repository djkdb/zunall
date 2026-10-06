/**
 * 모의 면접 진행 엔진 (서버).
 *
 * zunterview 의 브라우저 진행 로직(useInterview)을 그대로 옮기되, 상태는 DB 에 남는다.
 * 한 번 호출할 때마다 "답변 하나 처리 → 면접관이 할 말과 다음 질문"까지 진행한다.
 *
 *   질문 → 답변 → 분석(+꼬리질문 판단 병렬) → 반응 → 다음 질문 … → 종합 리포트
 *
 * AI 호출이 실패하면(형식 오류·거절·시간 초과) 그 호출만 규칙 기반 면접관이 대신 답하고,
 * 세 번 연속 실패하면 면접 끝까지 규칙 기반으로 진행한다. 면접이 중간에 멈추지 않는 게 먼저다.
 */
import type { GeneratedQuestion, ReportRequest } from "./shared/schemas";
import { getCompany, loadCompanyQuestions } from "./shared/companies";
import { roleContextFor } from "./shared/roles";
import { fillRole, questionPool } from "./shared/roleBank";
import { misconductOf, triageAnswer } from "./shared/answerTriage";
import { refersToDocuments, unaskable } from "./shared/questionRules";
import { hasDocuments } from "./shared/documents";
import { checkDocuments, type CheckTurn } from "./shared/documentCheck";
import { similarity, isDuplicateQuestion } from "./utils/fingerprint";
import { buildContext, toAIConfig, toCurrentTurn } from "./utils/context";
import { clarifyLine } from "./utils/clarify";
import { conductLine, conductReport } from "./utils/conduct";
import { allMainsAsked, canAskFollowUp, threadDepth } from "./utils/policy";
import { answerScore, categoryAverages, overallScore, strongestAndWeakest } from "./utils/scoring";
import { createId } from "./utils/id";
import { seatFor, type Seat } from "./panel";
import type { AIProvider } from "./provider-types";
import type { Interview, InterviewQuestion, ProviderKind, QuestionOrigin, Reanswer } from "./types";

/**
 * Cavero 가 면접 기록에 덧붙이는 값 (zunterview 원본 types.ts 는 손대지 않는다 — 동기화 스크립트가 덮어쓴다).
 */
declare module "./types" {
  interface Interview {
    /** 이 면접에서 AI 를 부른 횟수 (비용 상한용) */
    aiCalls?: number;
    /** 연속 AI 실패 수 */
    aiFails?: number;
    /** AI 가 계속 실패해 남은 진행을 규칙 기반 면접관이 맡는다 */
    forceMock?: boolean;
  }
}

export interface EngineDeps {
  /** 실제 AI 면접관. 없으면 처음부터 규칙 기반으로 진행한다. */
  ai: AIProvider | null;
  /** 규칙 기반 면접관 (AI 실패 시 대신 답한다) */
  mock: AIProvider;
  now?: () => number;
}

/** 면접관이 지금 하는 말 (화면에 보여주고, 원하면 읽어 준다) */
export interface PanelLine {
  seat: Seat;
  text: string;
  kind: "greeting" | "reaction" | "clarify" | "closing";
}

export interface Step {
  interview: Interview;
  lines: PanelLine[];
  finished: boolean;
}

/** 면접 한 번에 AI 를 부르는 상한. 넘으면 남은 진행은 규칙 기반으로 한다 (비용 상한) */
export const AI_CALL_BUDGET = 60;
const MAX_AI_FAILS = 3;

export const GREETING = "반갑습니다. 편하게 앉으세요. 지금부터 면접을 시작하겠습니다.";
export const FAREWELL = "이상으로 면접을 마치겠습니다. 수고 많으셨습니다.";

interface NextQuestion {
  gen: GeneratedQuestion;
  isFollowUp: boolean;
  parentId: string | null;
  reason?: string;
  anchor?: string;
  source: ProviderKind;
  origin?: QuestionOrigin;
}

const now = (d: EngineDeps) => (d.now ?? Date.now)();

function aiAvailable(i: Interview, d: EngineDeps): boolean {
  return Boolean(d.ai) && !i.forceMock && (i.aiCalls ?? 0) < AI_CALL_BUDGET;
}

/**
 * AI 한 번 호출. 실패하면 규칙 기반 면접관이 그 호출을 대신한다.
 * 호출 횟수와 연속 실패 수는 면접 기록(i)에 남긴다.
 */
async function withFallback<T>(i: Interview, d: EngineDeps, call: (p: AIProvider) => Promise<T>, useAi = true): Promise<[T, ProviderKind]> {
  if (!useAi || !aiAvailable(i, d)) return [await call(d.mock), "mock"];
  i.aiCalls = (i.aiCalls ?? 0) + 1;
  try {
    const value = await call(d.ai!);
    i.aiFails = 0;
    return [value, "ai"];
  } catch (error) {
    console.warn(`[mock-interview] AI 호출 실패 → 규칙 기반으로 대신 진행: ${error instanceof Error ? error.message.slice(0, 160) : "unknown"}`);
    i.aiFails = (i.aiFails ?? 0) + 1;
    if (i.aiFails >= MAX_AI_FAILS) i.forceMock = true;
    return [await call(d.mock), "mock"];
  }
}

const withProvider = (i: Interview, kind: ProviderKind) => {
  if (!i.providers.includes(kind)) i.providers = [...i.providers, kind];
};

/** 질문이 회사·직무 질문 은행에서 왔는지 ("공개후기 기반" 같은 표시용) */
async function originOf(text: string, interview: Interview): Promise<QuestionOrigin | undefined> {
  const config = interview.config;
  if (hasDocuments(config.documents) && refersToDocuments(text)) return "서류기반";
  const company = getCompany(config.companyId);
  const hit = company ? (await loadCompanyQuestions(company.id).catch(() => [])).find((q) => similarity(q.text, text) >= 0.55) : undefined;
  if (hit) return hit.basis;
  const role = roleContextFor(config);
  const pool = await questionPool(role).catch(() => []);
  const match = pool.find((q) => {
    const t = fillRole(q.text, role.title);
    return t === text || similarity(t, text) >= 0.6;
  });
  if (!match || match.basis === "일반면접") return undefined;
  return match.basis;
}

/** 본 질문 하나를 만든다. 반복·이 방에서 물을 수 없는 질문이면 한 번 더, 그래도면 규칙 기반 은행에서 */
async function nextMainQuestion(i: Interview, d: EngineDeps): Promise<NextQuestion> {
  const ctx = buildContext(i);
  const bad = (q: string) => isDuplicateQuestion(q, ctx.askedQuestions) || unaskable(q, ctx.progress.asked, hasDocuments(ctx.config.documents));
  let [gen, source] = await withFallback(i, d, (p) => p.generateQuestion(ctx));
  if (bad(gen.question) && source !== "mock") {
    [gen, source] = await withFallback(i, d, (p) => p.generateQuestion(ctx));
    if (bad(gen.question)) {
      gen = await d.mock.generateQuestion(ctx);
      source = "mock";
    }
  }
  return { gen, isFollowUp: false, parentId: null, source, origin: await originOf(gen.question, i) };
}

function present(i: Interview, next: NextQuestion, at: number, reaction?: string): InterviewQuestion {
  const question: InterviewQuestion = {
    id: createId("q"),
    text: next.gen.question,
    type: next.gen.type,
    isFollowUp: next.isFollowUp,
    parentId: next.parentId,
    followUpReason: next.reason ?? next.gen.intent,
    anchor: next.anchor || undefined,
    reaction,
    askedAt: at,
    answer: null,
    feedback: null,
    score: null,
    followUps: [],
    source: next.source,
    ...(next.origin && !next.isFollowUp ? { origin: next.origin } : {}),
  };
  withProvider(i, next.source);
  if (question.parentId) {
    i.questions = i.questions.map((p) => (p.id === question.parentId ? { ...p, followUps: [...p.followUps, question.id] } : p));
  }
  i.questions = [...i.questions, question];
  return question;
}

/** 지금 답을 기다리는 질문 */
export function currentQuestion(i: Interview): InterviewQuestion | null {
  const last = i.questions[i.questions.length - 1];
  return last && !last.answer ? last : null;
}

function checkTurns(i: Interview): CheckTurn[] {
  let thread = -1;
  return i.questions.map((q, idx) => {
    if (!q.isFollowUp) thread++;
    return { question: q.text, answer: q.answer ?? "", thread, no: idx + 1, score: q.score };
  });
}

/* ───────────────────────────── 시작 ───────────────────────────── */

const OPENING_GREETING = /^(?:안녕하세요[.,!]?\s*)?(?:(?:그럼|이제|지금부터)\s*)?면접을\s*시작하겠습니다[.,!]?\s*/;

/**
 * 면접위원장이 먼저 인사하고 시작을 알리므로, AI 가 첫 질문 앞에 붙인 인사("면접을 시작하겠습니다.")는 뗀다.
 * (프롬프트를 고치면 zunterview 와 갈라지니 여기서 정리한다)
 */
export function withoutGreeting(question: string): string {
  const rest = question.replace(OPENING_GREETING, "").trim();
  return rest.length >= 6 ? rest : question;
}

export async function startInterview(interview: Interview, d: EngineDeps): Promise<Step> {
  const i = structuredClone(interview);
  const first = await nextMainQuestion(i, d);
  first.gen = { ...first.gen, question: withoutGreeting(first.gen.question) };
  present(i, first, now(d), GREETING);
  return { interview: i, lines: [{ seat: "center", text: GREETING, kind: "greeting" }], finished: false };
}

/* ───────────────────────────── 끝내기 ───────────────────────────── */

async function complete(i: Interview, d: EngineDeps, endedEarly: boolean, terminated?: "conduct" | "informal"): Promise<void> {
  const answered = i.questions.filter((q) => q.answer && q.feedback);
  i.questions = answered;
  i.endedEarly = endedEarly;
  if (terminated) i.terminated = terminated;
  i.duration = Math.max(0, Math.round((now(d) - i.createdAt) / 1000));
  i.overallScore = overallScore(answered);
  i.categoryScores = categoryAverages(answered);
  if (!answered.length || !i.categoryScores || i.overallScore === null) {
    i.completed = true;
    return;
  }
  const { strongest, weakest } = strongestAndWeakest(i.categoryScores);
  const req: ReportRequest = {
    // 리포트는 문답만 보고 쓴다. 서류는 다시 보낼 필요가 없다.
    config: { ...toAIConfig(i), documents: undefined },
    turns: answered.map((q) => ({
      question: q.text.slice(0, 600),
      type: q.type,
      isFollowUp: q.isFollowUp,
      answerExcerpt: (q.answer ?? "").slice(0, 800),
      score: q.score ?? 0,
      strength: q.feedback!.strength.slice(0, 400),
      improve: q.feedback!.improve.slice(0, 400),
    })),
    computed: { overall: i.overallScore, categoryScores: i.categoryScores, strongest, weakest },
  };
  // 리포트는 결과 화면을 막으면 안 된다 — 실패하면 규칙 기반으로 쓴다.
  const [written, source] = await withFallback(i, d, (p) => p.generateFinalReport(req), !terminated);
  const report = terminated ? { ...written, ...conductReport("ko", terminated) } : written;
  withProvider(i, source);
  if (hasDocuments(i.config.documents)) {
    i.documentChecks = checkDocuments(i.config.documents, checkTurns(i));
    i.usedDocuments = (["resume", "coverLetter"] as const).filter((k) => i.config.documents![k].trim());
  }
  // 서류 원문은 면접이 끝나면 남기지 않는다 (무엇을 썼는지만 남긴다)
  i.config = { ...i.config, documents: undefined };
  i.report = report;
  i.completed = true;
}

export async function endInterview(interview: Interview, d: EngineDeps): Promise<Step> {
  const i = structuredClone(interview);
  // 아직 답하지 않은 마지막 질문은 버린다
  const open = currentQuestion(i);
  if (open) {
    i.questions = i.questions.slice(0, -1);
    if (open.parentId) i.questions = i.questions.map((p) => (p.id === open.parentId ? { ...p, followUps: p.followUps.filter((x) => x !== open.id) } : p));
  }
  await complete(i, d, true);
  return { interview: i, lines: [{ seat: "center", text: FAREWELL, kind: "closing" }], finished: true };
}

/* ───────────────────────────── 답변 처리 ───────────────────────────── */

export interface AnswerInput {
  questionId: string;
  answer: string;
  mode: "text" | "voice";
  durationSec: number;
}

export class EngineError extends Error {}

export async function answerQuestion(interview: Interview, input: AnswerInput, d: EngineDeps): Promise<Step> {
  const i = structuredClone(interview);
  const q = currentQuestion(i);
  const answer = input.answer.trim();
  if (!q || q.id !== input.questionId) throw new EngineError("이미 답한 질문입니다. 화면을 새로고침해 주세요.");
  if (!answer) throw new EngineError("답변을 입력해 주세요.");
  const seat = seatFor(q.type, q.isFollowUp);

  // "질문이 잘 이해가 안 돼요"는 답이 아니다: 무엇을 묻는지 설명하고 같은 질문을 다시 한다 (한 번만).
  if (!q.clarified && triageAnswer(answer, "ko") === "clarify") {
    const line = clarifyLine(q.type, i.config.persona, "ko");
    i.questions = i.questions.map((x) => (x.id === q.id ? { ...x, reaction: line, clarified: true } : x));
    return { interview: i, lines: [{ seat, text: line, kind: "clarify" }], finished: false };
  }

  const before = structuredClone(i);
  i.questions = i.questions.map((x) => (x.id === q.id ? { ...x, answer, answerMode: input.mode, answerDurationSec: Math.max(0, Math.round(input.durationSec)) } : x));
  const answered = i.questions.find((x) => x.id === q.id)!;

  const ctxBefore = buildContext(before);
  const turn = toCurrentTurn(q, answer);
  // 욕설·반말은 실제 면접처럼 그 자리에서 끝난다.
  const misconduct = misconductOf(answer, "ko");
  // 무례하거나 의미 없는 답은 AI 를 부르지 않고 어디서나 같은 규칙으로 처리한다.
  const useAi = !misconduct && !triageAnswer(answer, "ko");
  const mainsDone = allMainsAsked(before);
  const wantFollowUp = !misconduct && canAskFollowUp(before, q);
  const last = mainsDone && !wantFollowUp;
  const root = q.parentId ?? q.id;

  const analysisP = withFallback(i, d, (p) => p.analyzeAnswer(ctxBefore, turn), useAi);
  const followP = wantFollowUp ? withFallback(i, d, (p) => p.generateFollowUp(ctxBefore, turn, threadDepth(before, q)), useAi).then(([f, src]) => ({ f, src })) : null;
  const mainP = !misconduct && !mainsDone && !wantFollowUp ? nextMainQuestion(i, d) : null;
  const [[analysis, analysisSource], follow, main] = await Promise.all([analysisP, followP, mainP]);

  withProvider(i, analysisSource);
  answered.feedback = analysis;
  answered.score = answerScore(analysis);
  i.questions = i.questions.map((x) => (x.id === q.id ? answered : x));

  if (misconduct) {
    const reason = misconduct === "informal" ? "informal" : "conduct";
    const line = conductLine("ko", reason);
    await complete(i, d, true, reason);
    return { interview: i, lines: [{ seat: "center", text: line, kind: "closing" }], finished: true };
  }
  if (last) {
    await complete(i, d, false);
    return {
      interview: i,
      lines: [
        { seat, text: analysis.reaction, kind: "reaction" },
        { seat: "center", text: FAREWELL, kind: "closing" },
      ],
      finished: true,
    };
  }

  let next: NextQuestion | null = main;
  const decision = follow?.f;
  if (decision?.needed && !isDuplicateQuestion(decision.question, ctxBefore.askedQuestions) && !unaskable(decision.question, 1, hasDocuments(ctxBefore.config.documents))) {
    next = {
      gen: { question: decision.question, type: decision.type, intent: decision.reason },
      isFollowUp: true,
      parentId: root,
      reason: decision.reason,
      anchor: decision.anchor,
      source: follow!.src,
    };
  }
  if (!next && mainsDone) {
    await complete(i, d, false);
    return {
      interview: i,
      lines: [
        { seat, text: analysis.reaction, kind: "reaction" },
        { seat: "center", text: FAREWELL, kind: "closing" },
      ],
      finished: true,
    };
  }
  next ??= await nextMainQuestion(i, d);
  present(i, next, now(d), analysis.reaction);
  return { interview: i, lines: [{ seat, text: analysis.reaction, kind: "reaction" }], finished: false };
}

/* ───────────────────────────── 다시 답해 보기 ───────────────────────────── */

/**
 * 결과 화면에서 한 질문에 다시 답한다. 원래 답변을 받았을 때와 같은 맥락으로 같은 면접관이 채점하고,
 * 원래 답변과 점수는 그대로 둔다.
 */
export async function reanswerQuestion(interview: Interview, questionId: string, answer: string, d: EngineDeps): Promise<{ interview: Interview; reanswer: Reanswer }> {
  const i = structuredClone(interview);
  const idx = i.questions.findIndex((q) => q.id === questionId);
  const text = answer.trim();
  if (idx < 0) throw new EngineError("질문을 찾을 수 없습니다.");
  if (!text) throw new EngineError("답변을 입력해 주세요.");
  const q = i.questions[idx];
  const ctx = buildContext({ ...i, questions: [...i.questions.slice(0, idx), { ...q, answer: null }] });
  const turn = toCurrentTurn(q, text);
  const useAi = !misconductOf(text, "ko") && !triageAnswer(text, "ko");
  const [feedback, source] = await withFallback(i, d, (p) => p.analyzeAnswer(ctx, turn), useAi);
  const reanswer: Reanswer = { questionId, answer: text, score: answerScore(feedback), feedback, source, at: now(d) };
  i.reanswers = [...(i.reanswers ?? []), reanswer].slice(-30);
  return { interview: i, reanswer };
}
