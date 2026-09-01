import { z } from "zod";
import {
  ACTIVITY_TYPES,
  ACTIVITY_STATUSES,
  IMPORTANCE_LEVELS,
  EVENT_TYPES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  DOC_CATEGORIES,
  SUBMISSION_STATUSES,
} from "@/lib/constants";

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.")
  .or(z.literal(""))
  .optional()
  .transform((v) => (v ? v : null));

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : null;
    });

export const activitySchema = z.object({
  name: z.string().trim().min(1, "활동명을 입력해주세요.").max(120),
  organizer: optionalText(120),
  type: z.enum(Object.keys(ACTIVITY_TYPES) as [string, ...string[]]),
  status: z.enum(Object.keys(ACTIVITY_STATUSES) as [string, ...string[]]),
  importance: z.enum(Object.keys(IMPORTANCE_LEVELS) as [string, ...string[]]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  startDate: dateStr,
  endDate: dateStr,
  applyDeadline: dateStr,
  submitDeadline: dateStr,
  announceDate: dateStr,
  link: optionalText(500),
  contact: optionalText(120),
  memo: optionalText(2000),
  tagsText: optionalText(300),
});
export type ActivityInput = z.input<typeof activitySchema>;

export const portfolioSchema = z.object({
  role: optionalText(200),
  achievement: optionalText(1000),
  learned: optionalText(2000),
  skills: optionalText(300),
});
export type PortfolioInput = z.input<typeof portfolioSchema>;

export const eventSchema = z.object({
  title: z.string().trim().min(1, "일정 제목을 입력해주세요.").max(120),
  type: z.enum(Object.keys(EVENT_TYPES) as [string, ...string[]]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해주세요."),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .or(z.literal(""))
    .optional()
    .transform((v) => (v ? v : null)),
  endDate: dateStr,
  memo: optionalText(1000),
  activityId: optionalText(40),
});
export type EventInput = z.input<typeof eventSchema>;

export const taskSchema = z.object({
  title: z.string().trim().min(1, "작업 제목을 입력해주세요.").max(200),
  description: optionalText(2000),
  dueDate: dateStr,
  priority: z.enum(Object.keys(TASK_PRIORITIES) as [string, ...string[]]),
  status: z.enum(Object.keys(TASK_STATUSES) as [string, ...string[]]),
  activityId: optionalText(40),
});
export type TaskInput = z.input<typeof taskSchema>;

export const documentMetaSchema = z.object({
  category: z.enum(Object.keys(DOC_CATEGORIES) as [string, ...string[]]),
  description: optionalText(500),
});

export const submissionSchema = z.object({
  title: z.string().trim().min(1, "제출물 이름을 입력해주세요.").max(120),
  description: optionalText(1000),
  status: z.enum(Object.keys(SUBMISSION_STATUSES) as [string, ...string[]]),
  dueDate: dateStr,
});
export type SubmissionInput = z.input<typeof submissionSchema>;

export const criteriaItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  weight: z.coerce.number().min(0).max(1000),
  description: optionalText(500),
  source: z.enum(["official", "inferred", "manual"]).default("manual"),
});
