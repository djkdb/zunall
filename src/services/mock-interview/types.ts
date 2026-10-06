import type { DocumentCheck } from "./shared/documentCheck";
import type {
  AIConfig,
  AnswerAnalysis,
  CategoryKey,
  FinalReport,
  QuestionType,
} from "./shared/schemas";

export type { AIConfig, AnswerAnalysis, CategoryKey, FinalReport, QuestionType };

export interface InterviewConfig extends AIConfig {
  /** Seconds per answer; 0 = no limit. */
  answerTimeLimit: number;
  voiceEnabled: boolean;
  /** Show per-answer scores in the Interview Notes during the interview. */
  liveFeedback: boolean;
}

export type ProviderKind = "ai" | "mock";

export type QuestionOrigin = "후기" | "공식자료" | "공개후기" | "공고기반" | "직무기반" | "서류기반";

export interface InterviewQuestion {
  id: string;
  text: string;
  type: QuestionType;
  isFollowUp: boolean;
  /** Main question this follow-up belongs to (null for main questions). */
  parentId: string | null;
  /** Why the interviewer asked this follow-up / question. */
  followUpReason?: string;
  /** Verbatim phrase from the previous answer the follow-up picks up. */
  anchor?: string;
  /** Spoken lead-in before the question (reaction to the previous answer). */
  reaction?: string;
  /** The candidate asked what the question meant and the interviewer explained it (once per question). */
  clarified?: boolean;
  askedAt: number;
  answer: string | null;
  answerMode?: "text" | "voice";
  answerDurationSec?: number;
  feedback: AnswerAnalysis | null;
  score: number | null;
  /** IDs of follow-up questions asked on this question. */
  followUps: string[];
  source: ProviderKind;
  /**
   * Where the question comes from, when it matches our dataset: a company question
   * ("후기" reported by candidates / "공식자료" official material) or a role-bank question
   * (공개후기 / 공식자료 / 공고기반 / 직무기반). Never shown as a "past exam question".
   */
  origin?: QuestionOrigin;
}

export type CategoryScores = Record<CategoryKey, number>;

export interface Interview {
  id: string;
  createdAt: number;
  config: InterviewConfig;
  questions: InterviewQuestion[];
  overallScore: number | null;
  categoryScores: CategoryScores | null;
  report: FinalReport | null;
  /** Seconds. */
  duration: number;
  completed: boolean;
  endedEarly: boolean;
  /** The panel stopped the interview because of the candidate's conduct: swearing/insults, or banmal/chat-speak. */
  terminated?: "conduct" | "informal";
  /** Document-based interview: which documents were used (their text is not kept in history). */
  usedDocuments?: DocumentKind[];
  /** Document-based interview: what the answers said about the documents' numbers and roles. */
  documentChecks?: DocumentCheck[];
  /** Questions answered again from the result sheet, newest last. */
  reanswers?: Reanswer[];
  providers: ProviderKind[];
}

export type DocumentKind = "resume" | "coverLetter";

/** A second try at one question, scored by the same interviewer. */
export interface Reanswer {
  questionId: string;
  answer: string;
  score: number;
  feedback: AnswerAnalysis;
  source: ProviderKind;
  at: number;
}

/** Compact record persisted to localStorage for the history list. */
export interface InterviewSummary {
  id: string;
  createdAt: number;
  position: string;
  interviewType: InterviewConfig["interviewType"];
  score: number;
  duration: number;
  questionCount: number;
  strongest: CategoryKey | null;
  company?: string;
  usedDocuments?: DocumentKind[];
}
