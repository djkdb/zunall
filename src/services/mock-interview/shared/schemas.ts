/**
 * Shared contract between the browser and the API layer.
 *
 * - Request schemas are validated on the server before any prompt is built.
 * - Response schemas are used as Claude structured-output formats on the server
 *   AND re-validated in the browser, so a malformed AI response can never
 *   reach the UI unchecked.
 */
import { z } from "zod";

export const QUESTION_TYPES = [
  "opening",
  "motivation",
  "role_understanding",
  "company_understanding",
  "behavioral",
  "experience",
  "deep_dive",
  "situational",
  "role_specific",
  "technical",
  "case",
  "numerical",
  "analytical",
  "industry",
  "leadership",
  "communication",
  "ethics",
  "challenge",
  "reflection",
  "result",
  "pt",
  "debate",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const CATEGORY_KEYS = [
  "relevance",
  "logic",
  "specificity",
  "structure",
  "communication",
  "confidence",
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const STAR_STATUS = ["present", "partial", "missing"] as const;
export type StarStatus = (typeof STAR_STATUS)[number];

export const ANSWER_QUALITY = ["strong", "adequate", "vague", "insufficient", "off_topic"] as const;
export type AnswerQuality = (typeof ANSWER_QUALITY)[number];

export const EXPERIENCE_LEVELS = ["entry", "junior", "mid", "senior"] as const;
export const INTERVIEW_TYPES = ["hr", "technical", "project", "behavioral", "mixed"] as const;
export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export const PERSONAS = ["professional", "friendly", "strict", "technical"] as const;
export const LANGUAGES = ["ko", "en"] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type Persona = (typeof PERSONAS)[number];
export type Language = (typeof LANGUAGES)[number];

/**
 * Interview archetypes: families of jobs that are interviewed alike
 * (an accountant and an auditor, a nurse and a physical therapist…).
 * Each archetype has an interview blueprint in shared/blueprints.ts.
 */
export const ARCHETYPES = [
  "tech_dev",
  "data_analytic",
  "product_planning",
  "strategy_business",
  "finance_accounting",
  "finance_markets",
  "hr_people",
  "admin_support",
  "legal_compliance",
  "marketing_growth",
  "sales_customer",
  "commerce_md",
  "supply_ops",
  "service_hospitality",
  "design_creative",
  "media_content",
  "engineering_design",
  "manufacturing_quality",
  "field_construction",
  "safety_environment",
  "research_science",
  "clinical_care",
  "education",
  "social_care",
  "public_service",
  "general",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

const ID = /^[a-z0-9_]{2,40}$/;
const shortText = (n: number) => z.string().trim().min(1).max(n);

/**
 * A practice profile for a job that is not in our taxonomy ("반도체 공정 엔지니어" typed freely).
 * Inferred by the RoleResolver (heuristic in the browser, or by the AI) — it describes typical
 * work for question generation and is never presented as fact about a real employer.
 */
export const CustomRoleSchema = z.object({
  title: shortText(60),
  domain: z.string().regex(ID),
  family: shortText(40),
  archetype: z.enum(ARCHETYPES),
  skills: z.array(shortText(40)).max(8),
  topics: z.array(shortText(40)).max(10),
});
export type CustomRole = z.infer<typeof CustomRoleSchema>;
/* ───────────────────────────── Request side ───────────────────────────── */

export const LIMITS = {
  position: 80,
  jobDescription: 4000,
  question: 600,
  answer: 4000,
  historyTurns: 6,
  askedQuestions: 40,
  /** Each of the résumé and the cover letter (document-based interviews). */
  document: 3000,
} as const;

/** The candidate's own documents, already stripped of contact details in the browser. */
export const DocumentsSchema = z.object({
  resume: z.string().max(LIMITS.document),
  coverLetter: z.string().max(LIMITS.document),
});
export type Documents = z.infer<typeof DocumentsSchema>;

export const AIConfigSchema = z.object({
  position: z.string().trim().min(1).max(LIMITS.position),
  experience: z.enum(EXPERIENCE_LEVELS),
  interviewType: z.enum(INTERVIEW_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  questionLimit: z.number().int().min(1).max(20),
  jobDescription: z.string().max(LIMITS.jobDescription),
  persona: z.enum(PERSONAS),
  language: z.enum(LANGUAGES),
  /** Company interview mode: resolved server-side from our own dataset, never free text. */
  companyId: z.string().regex(/^[a-z0-9-]{2,40}$/).optional(),
  companyTrack: z.string().max(20).optional(),
  /** Role mode: a role from our taxonomy (resolved server-side by id)… */
  roleId: z.string().regex(ID).optional(),
  /** …or an inferred practice profile for a job typed freely. */
  customRole: CustomRoleSchema.optional(),
  /** Document-based interview: the résumé / cover letter the candidate pasted (omitted = no documents). */
  documents: DocumentsSchema.optional(),
});
export type AIConfig = z.infer<typeof AIConfigSchema>;

export const TurnSchema = z.object({
  question: z.string().max(LIMITS.question),
  type: z.enum(QUESTION_TYPES),
  isFollowUp: z.boolean(),
  answer: z.string().max(LIMITS.answer),
});
export type Turn = z.infer<typeof TurnSchema>;

export const ContextSchema = z.object({
  config: AIConfigSchema,
  progress: z.object({
    /** Main questions asked so far (follow-ups don't count toward the question limit). */
    asked: z.number().int().min(0).max(40),
    total: z.number().int().min(1).max(20),
    /** Follow-ups asked so far. */
    followUps: z.number().int().min(0).max(40).optional(),
  }),
  /** Most recent turns in full (bounded window). */
  history: z.array(TurnSchema).max(LIMITS.historyTurns),
  /** Every question asked so far — used to avoid repeats. */
  askedQuestions: z.array(z.string().max(LIMITS.question)).max(LIMITS.askedQuestions),
  usedTypes: z.array(z.enum(QUESTION_TYPES)).max(LIMITS.askedQuestions),
});
export type InterviewContext = z.infer<typeof ContextSchema>;

export const CurrentTurnSchema = z.object({
  question: z.string().min(1).max(LIMITS.question),
  type: z.enum(QUESTION_TYPES),
  isFollowUp: z.boolean(),
  answer: z.string().min(1).max(LIMITS.answer),
});
export type CurrentTurn = z.infer<typeof CurrentTurnSchema>;

export const QuestionRequestSchema = z.object({ context: ContextSchema });
export const AnalyzeRequestSchema = z.object({ context: ContextSchema, turn: CurrentTurnSchema });
export const FollowUpRequestSchema = z.object({
  context: ContextSchema,
  turn: CurrentTurnSchema,
  /** How many follow-ups have already been asked on this thread. */
  depth: z.number().int().min(0).max(5),
});

export const ReportTurnSchema = z.object({
  question: z.string().max(LIMITS.question),
  type: z.enum(QUESTION_TYPES),
  isFollowUp: z.boolean(),
  answerExcerpt: z.string().max(800),
  score: z.number().min(0).max(100),
  strength: z.string().max(400),
  improve: z.string().max(400),
});
export const ReportRequestSchema = z.object({
  config: AIConfigSchema,
  turns: z.array(ReportTurnSchema).min(1).max(40),
  computed: z.object({
    overall: z.number().min(0).max(100),
    categoryScores: z.record(z.enum(CATEGORY_KEYS), z.number().min(0).max(100)),
    strongest: z.enum(CATEGORY_KEYS),
    weakest: z.enum(CATEGORY_KEYS),
  }),
});
export type ReportRequest = z.infer<typeof ReportRequestSchema>;

/* ───────────────────────────── Response side ──────────────────────────── */

export const GeneratedQuestionSchema = z.object({
  question: z.string().describe("The question to ask, one or two short sentences."),
  type: z.enum(QUESTION_TYPES),
  intent: z.string().describe("One short sentence: what this question is meant to verify."),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const FollowUpDecisionSchema = z.object({
  needed: z.boolean().describe("true if a follow-up on this same topic is the most useful next question."),
  question: z.string().describe("The follow-up question. Empty string when needed=false."),
  type: z.enum(QUESTION_TYPES),
  reason: z.string().describe("Why this follow-up, referring only to what the answer said or lacked."),
  anchor: z
    .string()
    .describe("A short verbatim phrase copied from the candidate's answer that the follow-up picks up. Empty if none."),
});
export type FollowUpDecision = z.infer<typeof FollowUpDecisionSchema>;

const CategoryScoreSchema = z.object({
  score: z.number().int().describe("0-100"),
  reason: z.string().describe("One short sentence grounded in the answer."),
});
export type CategoryScore = z.infer<typeof CategoryScoreSchema>;

const StarPartSchema = z.object({
  status: z.enum(STAR_STATUS),
  note: z.string(),
});
export type StarPart = z.infer<typeof StarPartSchema>;

export const AnswerAnalysisSchema = z.object({
  quality: z.enum(ANSWER_QUALITY),
  scores: z.object({
    relevance: CategoryScoreSchema,
    logic: CategoryScoreSchema,
    specificity: CategoryScoreSchema,
    structure: CategoryScoreSchema,
    communication: CategoryScoreSchema,
    confidence: CategoryScoreSchema,
  }),
  star: z.object({
    applicable: z.boolean(),
    situation: StarPartSchema,
    task: StarPartSchema,
    action: StarPartSchema,
    result: StarPartSchema,
  }),
  strength: z.string(),
  improve: z.string(),
  betterAnswer: z.object({
    problem: z.string(),
    suggestion: z.string(),
    example: z
      .string()
      .describe("An illustrative example sentence. Use [bracketed placeholders] for any fact the candidate did not state."),
  }),
  roleSignal: z
    .object({
      label: z.string().describe("The role-specific competency this answer speaks to, e.g. '정확성·기준 준수' for accounting."),
      note: z.string().describe("One sentence on how the answer shows (or lacks) it, grounded in the answer."),
    })
    .nullable()
    .describe("Role-specific feedback signal on top of the common scores. null if the answer gives nothing to judge it by."),
  evidence: z.array(z.string()).describe("Up to 3 short verbatim quotes from the answer that support the scores."),
  notFound: z.array(z.string()).describe("Up to 3 pieces of information the answer did not contain."),
  reaction: z.string().describe("The interviewer's brief spoken reaction before moving on. One sentence."),
});
export type AnswerAnalysis = z.infer<typeof AnswerAnalysisSchema>;

export const FinalReportSchema = z.object({
  headline: z.string().describe("One-line summary of the interview."),
  topFeedback: z.string().describe("The single most useful piece of feedback."),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  nextSteps: z.array(z.string()),
  closingRemark: z.string().describe("The interviewer's closing line to the candidate."),
});
export type FinalReport = z.infer<typeof FinalReportSchema>;

/** Usage metadata the server attaches to every AI response. */
export const UsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  /** Prompt-cache reads / writes (the system prompt is cached across an interview's turns). */
  cacheReadTokens: z.number().optional(),
  cacheWriteTokens: z.number().optional(),
  model: z.string(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const HealthSchema = z.object({
  ok: z.boolean(),
  ai: z.boolean(),
  model: z.string().nullable(),
  /** Server-side neural TTS provider, when configured. */
  tts: z.enum(["typecast", "elevenlabs", "fish"]).nullable().optional(),
});

/** Who is speaking: the three interviewers, or the staff member calling the candidate in. */
export const VOICES = ["left", "center", "right", "staff"] as const;
export type Voice = (typeof VOICES)[number];

export const TtsRequestSchema = z.object({
  text: z.string().trim().min(1).max(400),
  voice: z.enum(VOICES),
  speed: z.number().min(0.5).max(2).optional(),
});
export type TtsRequest = z.infer<typeof TtsRequestSchema>;

/* ───────────────────────────── Role resolver ──────────────────────────── */

export const RoleProfileRequestSchema = z.object({
  position: z.string().trim().min(1).max(LIMITS.position),
  language: z.enum(LANGUAGES),
});

/** What the AI infers for a job typed freely. The domain must be one of ours (validated server-side). */
export const InferredRoleSchema = z.object({
  domain: z.string().describe("The closest domain id from the list provided."),
  family: z.string().describe("A short job-family name in Korean, e.g. '공정·제조'."),
  title: z.string().describe("The role title as the candidate would say it, in Korean."),
  archetype: z.enum(ARCHETYPES).describe("How this job is typically interviewed."),
  skills: z.array(z.string()).describe("5-8 short core skills typical for this job."),
  topics: z.array(z.string()).describe("6-10 short interview topics typical for this job (Korean)."),
});
export type InferredRole = z.infer<typeof InferredRoleSchema>;
export type Health = z.infer<typeof HealthSchema>;
