import { z } from "zod";

// ─── AI 출력 JSON 스키마 ─────────────────────────────────────
// 모든 provider(mock/claude)는 이 스키마를 준수하는 JSON을 반환해야 하며,
// evaluator가 zod로 검증하고 실패 시 재시도한다.

const stringArray = z.array(z.string()).default([]);

/** 공고문 분석 결과 */
export const announcementSummarySchema = z.object({
  summary: z.string().default(""),
  schedule: z
    .array(
      z.object({
        label: z.string(),
        date: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
      }),
    )
    .default([]),
  eligibility: stringArray,
  requirements: stringArray, // 필수 제출물
  criteria: z
    .array(
      z.object({
        name: z.string(),
        weight: z.number().min(0).max(1000).default(0),
        description: z.string().nullable().optional(),
        source: z.enum(["official", "inferred"]).default("inferred"),
      }),
    )
    .default([]),
  cautions: stringArray,
  prizes: stringArray,
  /** 공고문에서 발견한 주요 날짜: 지원 마감 / 제출 마감 / 발표일 (YYYY-MM-DD) */
  keyDates: z
    .object({
      applyDeadline: z.string().nullable().optional(),
      submitDeadline: z.string().nullable().optional(),
      announceDate: z.string().nullable().optional(),
    })
    .default({}),
});
export type AnnouncementSummary = z.infer<typeof announcementSummarySchema>;

/** 제출물 평가 결과 (핵심 기능) */
export const evaluationResultSchema = z.object({
  overall_score: z.number().min(0),
  max_score: z.number().positive(),
  confidence: z.number().min(0).max(1).default(0.5),
  criteria: z
    .array(
      z.object({
        name: z.string(),
        score: z.number().min(0),
        max_score: z.number().positive(),
        source: z.enum(["official", "inferred"]).default("official"),
        strengths: stringArray,
        weaknesses: stringArray,
        recommendations: stringArray,
      }),
    )
    .min(1),
  summary: z.string().default(""),
  critical_issues: stringArray,
  next_actions: stringArray,
});
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

/** 제출 전 최종 검토 결과 */
export const finalCheckSchema = z.object({
  score: z.number().min(0).max(100),
  checks: z
    .array(
      z.object({
        label: z.string(),
        status: z.enum(["pass", "warn", "fail"]),
        detail: z.string().default(""),
      }),
    )
    .min(1),
  summary: z.string().default(""),
  recommendations: stringArray,
});
export type FinalCheckResult = z.infer<typeof finalCheckSchema>;

/** 적합도 분석 / 첨삭 / 개선점 / 예상 질문 등 범용 조언 결과 */
export const adviceResultSchema = z.object({
  headline: z.string().default(""),
  summary: z.string().default(""),
  /** 0~100 (적합도 등 점수화 가능한 경우) */
  score: z.number().min(0).max(100).nullable().optional(),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        items: z.array(z.string()).min(1),
      }),
    )
    .min(1),
  next_actions: stringArray,
});
export type AdviceResult = z.infer<typeof adviceResultSchema>;

export type AIResultData =
  | { kind: "announcement"; data: AnnouncementSummary }
  | { kind: "evaluation"; data: EvaluationResult }
  | { kind: "final_check"; data: FinalCheckResult }
  | { kind: "advice"; data: AdviceResult };
