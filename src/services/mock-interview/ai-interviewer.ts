import "server-only";
import type { z } from "zod";
import { getProvider, getProviderName, EMPTY_AI_CONTEXT, type AIProvider as CaveroProvider } from "@/services/ai/provider";
import { extractJson } from "@/services/ai/parse-json";
import {
  AnswerAnalysisSchema,
  CustomRoleSchema,
  FinalReportSchema,
  FollowUpDecisionSchema,
  GeneratedQuestionSchema,
  InferredRoleSchema,
  QUESTION_TYPES,
  ARCHETYPES,
  type CurrentTurn,
  type CustomRole,
  type InterviewContext,
  type Language,
  type ReportRequest,
} from "./shared/schemas";
import { sanitizeAnalysis, sanitizeFollowUp, sanitizeQuestion, sanitizeReport } from "./shared/sanitize";
import { getDomain, guessDomain } from "./shared/roles";
import { questionPrompt } from "./prompts/questionPrompt";
import { followUpPrompt } from "./prompts/followupPrompt";
import { analysisPrompt } from "./prompts/analysisPrompt";
import { reportPrompt } from "./prompts/reportPrompt";
import { rolePrompt } from "./prompts/rolePrompt";
import { MockAIProvider } from "./mock/MockAIProvider";
import type { AIProvider } from "./provider-types";
import { installDataLoader } from "./server-data";

/**
 * zunterview 의 면접 프롬프트를 Cavero 의 AI 연결(API / Claude CLI)로 부른다.
 * 프롬프트는 서버에서만 만든다 — 브라우저는 정해진 형식의 면접 데이터만 보낼 수 있다.
 *
 * zunterview 는 API 의 구조화 출력을 썼지만, Cavero 는 CLI 도 지원하므로
 * "JSON 하나만, 이 모양으로"를 프롬프트에 적고 받은 뒤 스키마로 검사한다 (실패하면 한 번 더).
 */

const TYPES = QUESTION_TYPES.join(" | ");

const SHAPES = {
  question: `{"question": "the question to ask, one or two short sentences", "type": "${TYPES}", "intent": "one short sentence: what this question is meant to verify"}`,
  followUp: `{"needed": true or false, "question": "the follow-up question, empty string when needed=false", "type": "${TYPES}", "reason": "why this follow-up, referring only to what the answer said or lacked", "anchor": "a short verbatim phrase copied from the candidate's answer that the follow-up picks up, empty if none"}`,
  analysis: `{
  "quality": "strong | adequate | vague | insufficient | off_topic",
  "scores": {
    "relevance": {"score": integer 0-100, "reason": "one short sentence grounded in the answer"},
    "logic": {"score": ..., "reason": ...},
    "specificity": {"score": ..., "reason": ...},
    "structure": {"score": ..., "reason": ...},
    "communication": {"score": ..., "reason": ...},
    "confidence": {"score": ..., "reason": ...}
  },
  "star": {
    "applicable": true or false,
    "situation": {"status": "present | partial | missing", "note": "..."},
    "task": {"status": ..., "note": ...},
    "action": {"status": ..., "note": ...},
    "result": {"status": ..., "note": ...}
  },
  "strength": "...",
  "improve": "...",
  "betterAnswer": {"problem": "...", "suggestion": "...", "example": "an illustrative example sentence with [bracketed placeholders] for facts the candidate did not state"},
  "roleSignal": {"label": "...", "note": "..."} or null,
  "evidence": ["up to 3 short verbatim quotes from the answer"],
  "notFound": ["up to 3 pieces of information the answer did not contain"],
  "reaction": "the interviewer's brief spoken reaction before moving on, one sentence"
}`,
  report: `{"headline": "one-line summary of the interview", "topFeedback": "the single most useful piece of feedback", "strengths": ["..."], "improvements": ["..."], "nextSteps": ["..."], "closingRemark": "the interviewer's closing line to the candidate"}`,
  role: `{"domain": "the closest domain id from the list", "family": "short job-family name in Korean", "title": "the role title in Korean", "archetype": "${ARCHETYPES.join(" | ")}", "skills": ["5-8 short core skills"], "topics": ["6-10 short interview topics in Korean"]}`,
} as const;

const formatRule = (shape: string) => `## Output format
Reply with exactly one JSON object and nothing else (no code fence, no commentary), in this shape:
${shape}`;

/** 면접 문답은 기다림이 중요하다. 기본은 앱의 모델 + low, ANTHROPIC_INTERVIEW_MODEL 로 따로 정할 수 있다. */
const INTERVIEW_TIMEOUT_MS = 60_000;

export class CaveroInterviewer implements AIProvider {
  readonly kind = "ai" as const;
  readonly label = "AI 면접관";

  constructor(private readonly provider: CaveroProvider) {}

  private async call<S extends z.ZodTypeAny>(parts: { system: string; user: string }, schema: S, shape: string): Promise<z.infer<S>> {
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const retry = attempt === 0 ? "" : `\n\nYour previous reply did not match the format (${lastError}). Reply again with only the JSON object.`;
      const raw = await this.provider.complete({
        action: "mock_interview",
        system: parts.system,
        prompt: `${parts.user}\n\n${formatRule(shape)}${retry}`,
        context: EMPTY_AI_CONTEXT,
        effort: "low",
        model: process.env.ANTHROPIC_INTERVIEW_MODEL || undefined,
        timeoutMs: INTERVIEW_TIMEOUT_MS,
      });
      try {
        const parsed = schema.safeParse(extractJson(raw));
        if (parsed.success) return parsed.data;
        lastError = parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
    throw new Error(`면접 AI 응답 형식 오류: ${lastError}`);
  }

  async generateQuestion(ctx: InterviewContext) {
    return sanitizeQuestion(await this.call(await questionPrompt(ctx), GeneratedQuestionSchema, SHAPES.question));
  }

  async generateFollowUp(ctx: InterviewContext, turn: CurrentTurn, depth: number) {
    const out = await this.call(await followUpPrompt(ctx, turn, depth), FollowUpDecisionSchema, SHAPES.followUp);
    return sanitizeFollowUp(out, turn.answer);
  }

  async analyzeAnswer(ctx: InterviewContext, turn: CurrentTurn) {
    const out = await this.call(await analysisPrompt(ctx, turn), AnswerAnalysisSchema, SHAPES.analysis);
    return sanitizeAnalysis(out, turn.answer);
  }

  async generateFinalReport(req: ReportRequest) {
    return sanitizeReport(await this.call(await reportPrompt(req), FinalReportSchema, SHAPES.report));
  }

  async inferRole(position: string, language: Language): Promise<CustomRole | null> {
    const r = await this.call(rolePrompt(position, language), InferredRoleSchema, SHAPES.role);
    // 도메인은 우리 목록에 있는 것만 — 모델이 준 값을 그대로 믿지 않는다
    const domain = getDomain(r.domain) ? r.domain : (guessDomain(position)?.id ?? "strategy");
    const clip = (xs: string[], n: number) => xs.map((x) => x.trim().slice(0, 40)).filter(Boolean).slice(0, n);
    const parsed = CustomRoleSchema.safeParse({
      title: position.slice(0, 60),
      domain,
      family: r.family.trim().slice(0, 40) || "기타",
      archetype: r.archetype,
      skills: clip(r.skills, 8),
      topics: clip(r.topics, 10),
    });
    return parsed.success ? parsed.data : null;
  }
}

export interface Interviewers {
  ai: AIProvider | null;
  mock: AIProvider;
  /** 화면 표시용: 실제 AI 가 면접을 보는가 */
  real: boolean;
}

/** 지금 설정으로 쓸 수 있는 면접관. AI 가 없으면 규칙 기반 면접관만. */
export async function getInterviewers(): Promise<Interviewers> {
  installDataLoader();
  const mock = new MockAIProvider(false);
  if (getProviderName() === "mock") return { ai: null, mock, real: false };
  return { ai: new CaveroInterviewer(await getProvider()), mock, real: true };
}
