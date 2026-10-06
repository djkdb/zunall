/** Korean UI labels (the prompts keep using shared/labels.ts). */
import type { CategoryKey, Difficulty, ExperienceLevel, InterviewType, Persona, QuestionType } from "./shared/schemas";

export const EXPERIENCE_KO: Record<ExperienceLevel, string> = {
  entry: "신입",
  junior: "주니어 (1~3년)",
  mid: "미들 (4~7년)",
  senior: "시니어 (8년+)",
};

export const INTERVIEW_TYPE_KO: Record<InterviewType, string> = {
  hr: "인성 면접",
  technical: "직무 면접",
  project: "경험·프로젝트",
  behavioral: "경험 면접",
  mixed: "종합 면접",
};

export const INTERVIEW_TYPE_HINT_KO: Record<InterviewType, string> = {
  hr: "지원동기, 조직적합성",
  technical: "직무 지식과 실무",
  project: "수행 경험 검증",
  behavioral: "과거 경험, STAR",
  mixed: "실제 1차 면접처럼",
};

export const DIFFICULTY_KO: Record<Difficulty, string> = {
  easy: "편안하게",
  normal: "실전",
  hard: "압박",
};

export const PERSONA_KO: Record<Persona, string> = {
  professional: "정중한",
  friendly: "친근한",
  strict: "깐깐한",
  technical: "실무 전문가",
};

export const QUESTION_TYPE_KO: Record<QuestionType, string> = {
  opening: "도입",
  motivation: "지원동기",
  role_understanding: "직무 이해",
  company_understanding: "기업 이해",
  behavioral: "인성·역량",
  experience: "경험",
  deep_dive: "심층",
  situational: "상황 대처",
  role_specific: "직무 실무",
  technical: "기술",
  case: "케이스",
  numerical: "수치 판단",
  analytical: "분석",
  industry: "산업 이해",
  leadership: "리더십",
  communication: "소통",
  ethics: "윤리",
  challenge: "압박·반론",
  reflection: "인성·성찰",
  result: "성과 검증",
  pt: "PT",
  debate: "토론",
};

export const CATEGORY_KO: Record<CategoryKey, string> = {
  relevance: "질문 이해도",
  logic: "논리성",
  specificity: "구체성",
  structure: "답변 구조",
  communication: "전달력",
  confidence: "자신감",
};

export const CATEGORY_DESC_KO: Record<CategoryKey, string> = {
  relevance: "질문의 의도에 맞게 답했는가",
  logic: "판단의 근거와 인과가 분명한가",
  specificity: "사례·방법·수치가 구체적인가",
  structure: "두괄식·STAR 흐름으로 정리됐는가",
  communication: "간결하고 명확하게 전달했는가",
  confidence: "본인의 역할을 확신 있게 말했는가",
};

export function grade(score: number): "S" | "A" | "B" | "C" | "D" {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}
