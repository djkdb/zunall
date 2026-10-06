/** Human-readable labels shared by prompts (server) and UI (client). */
import type { CategoryKey, Difficulty, ExperienceLevel, InterviewType, Persona, QuestionType } from "./schemas";

export const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  entry: "Entry",
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
};

export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  hr: "HR",
  technical: "Job knowledge / technical",
  project: "Project",
  behavioral: "Behavioral",
  mixed: "Mixed",
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

export const PERSONA_LABEL: Record<Persona, string> = {
  professional: "Professional",
  friendly: "Friendly",
  strict: "Strict",
  technical: "Technical",
};

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  opening: "Opening",
  motivation: "Motivation",
  role_understanding: "Role understanding",
  company_understanding: "Company understanding",
  behavioral: "Behavioral",
  experience: "Experience",
  deep_dive: "Deep Dive",
  situational: "Situational",
  role_specific: "Role-specific practice",
  technical: "Technical",
  case: "Case",
  numerical: "Numerical",
  analytical: "Analytical",
  industry: "Industry",
  leadership: "Leadership",
  communication: "Communication",
  ethics: "Ethics",
  challenge: "Challenge",
  reflection: "Reflection",
  result: "Result",
  pt: "Presentation (PT)",
  debate: "Debate",
};

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  relevance: "Relevance",
  logic: "Logic",
  specificity: "Specificity",
  structure: "Structure",
  communication: "Communication",
  confidence: "Confidence",
};
