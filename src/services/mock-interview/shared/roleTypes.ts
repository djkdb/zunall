/**
 * Types for the role (직무) dataset: Domain → Job family → Role, role profiles
 * and the role question bank. Shared by the data pipeline, the server and the app.
 */
import type { Archetype, Difficulty, ExperienceLevel, QuestionType } from "./schemas";

export const QUESTION_CATEGORIES = [
  "자기소개", "지원동기", "직무이해", "기업이해", "경험", "팀워크", "갈등", "리더십", "실패", "성공",
  "문제해결", "의사결정", "커뮤니케이션", "상황대처", "윤리", "가치관", "강점", "약점", "성장", "성과",
  "직무전문성", "실무", "도구", "기술", "산업", "시장", "경쟁", "고객", "데이터", "전략",
  "사례", "PT", "토론", "압박", "조직적합성", "기타",
] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

/**
 * Where a question comes from. Only 공개후기/공식자료/공고기반 questions are grounded in a source;
 * 직무기반/일반면접 are practice questions written from the role's typical work — never "기출".
 */
export const QUESTION_BASES = ["공개후기", "공식자료", "공고기반", "직무기반", "일반면접"] as const;
export type QuestionBasis = (typeof QUESTION_BASES)[number];

export const SOURCE_TYPES = ["interview_review", "official_recruitment", "job_description", "ncs", "role_research", "other_public"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const CONFIDENCE = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export interface RoleGroup {
  id: string;
  name: string;
}

export interface DomainEntry {
  id: string;
  name: string;
  nameEn: string;
  group: string;
  /** Questions scoped to this domain and below. */
  q: number;
}

export interface FamilyEntry {
  id: string;
  domain: string;
  name: string;
  nameEn: string;
  /** The practitioner interviewer's department ("재무팀", "간호부"). */
  dept: string;
  archetype: Archetype;
  q: number;
}

export interface RoleEntry {
  id: string;
  family: string;
  ko: string;
  en: string;
  /** Korean + English names, abbreviations and common spellings used for search. */
  aliases: string[];
  /** Role-level questions (family/domain/common questions come on top). */
  q: number;
}

export interface RoleDataStats {
  roles: number;
  domains: number;
  families: number;
  /** All role-mode questions, including the common bank. */
  questions: number;
  commonQuestions: number;
  byBasis: Record<QuestionBasis, number>;
  sources: number;
  generatedAt: string;
}

export interface RoleTaxonomy {
  groups: RoleGroup[];
  domains: DomainEntry[];
  families: FamilyEntry[];
  roles: RoleEntry[];
  stats: RoleDataStats;
}

/** Detailed profile, loaded on demand (public/data/roles/profiles.json). */
export interface RoleProfileDetail {
  skills: string[];
  responsibilities: string[];
  keywords: string[];
  topics: { role: string[]; scenario: string[]; result: string[]; en: string[] };
}

export interface QuestionSource {
  title: string;
  url: string;
  type: SourceType;
  year?: number;
}

/** Compact on-disk question record (public/data/roles/*.json). */
export interface PackedQuestion {
  /** text */
  t: string;
  /** scope: "common" | "domain:<id>" | "family:<id>" | "role:<id>" */
  s: string;
  /** category */
  c: QuestionCategory;
  /** type */
  y: QuestionType;
  /** difficulty */
  d: Difficulty;
  /** levels (omitted = all) */
  l?: ExperienceLevel[];
  /** basis */
  b: QuestionBasis;
  /** index into the file's source list */
  r?: number;
  /** confidence */
  cf: Confidence;
  /** English version (common bank) */
  en?: string;
}

export interface PackedQuestionFile {
  version: 1;
  sources: QuestionSource[];
  questions: PackedQuestion[];
}

export interface RoleQuestion {
  text: string;
  en?: string;
  scope: string;
  category: QuestionCategory;
  type: QuestionType;
  difficulty: Difficulty;
  levels?: ExperienceLevel[];
  basis: QuestionBasis;
  sourceType: SourceType;
  source?: QuestionSource;
  confidence: Confidence;
}
