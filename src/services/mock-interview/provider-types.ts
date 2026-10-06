import type {
  CustomRole,
  Language,
  AnswerAnalysis,
  CurrentTurn,
  FinalReport,
  FollowUpDecision,
  GeneratedQuestion,
  InterviewContext,
  ReportRequest,
  Usage,
} from "./shared/schemas";
import type { ProviderKind } from "./types";

/**
 * Everything the interview needs from "the AI". Swap implementations to change
 * model/vendor without touching UI or interview logic.
 */
export interface AIProvider {
  readonly kind: ProviderKind;
  readonly label: string;
  generateQuestion(ctx: InterviewContext): Promise<GeneratedQuestion>;
  generateFollowUp(ctx: InterviewContext, turn: CurrentTurn, depth: number): Promise<FollowUpDecision>;
  analyzeAnswer(ctx: InterviewContext, turn: CurrentTurn): Promise<AnswerAnalysis>;
  generateFinalReport(req: ReportRequest): Promise<FinalReport>;
  /** RoleResolver: a practice profile for a job title outside the taxonomy (AI mode only). */
  inferRole?(position: string, language: Language): Promise<CustomRole | null>;
}

export type AIErrorKind = "network" | "timeout" | "server" | "parse" | "unavailable" | "refusal" | "rate_limited" | "injected";

export class AIRequestError extends Error {
  constructor(
    public readonly kind: AIErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AIRequestError";
  }
}

export type UsageListener = (usage: Usage) => void;
