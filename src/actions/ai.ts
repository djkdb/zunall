"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, activities, aiReviews, evaluationCriteria, events, tasks } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logHistory } from "@/lib/history";
import { newId } from "@/lib/utils";
import { runAIAction } from "@/services/ai/evaluator";
import { announcementSummarySchema } from "@/services/ai/schemas";
import { criteriaItemSchema } from "@/lib/validators";
import { AI_ACTIONS, type AIAction } from "@/lib/constants";
import type { ActionResult } from "@/actions/activities";

export interface RunAIActionResult {
  ok: boolean;
  reviewId?: string;
  error?: string;
}

/** AI 액션 실행 (활동 소유권은 runAIAction 내부에서 검증) */
export async function runAI(
  activityId: string,
  action: string,
  submissionId?: string | null,
): Promise<RunAIActionResult> {
  const user = await requireUser();
  if (!(action in AI_ACTIONS)) return { ok: false, error: "지원하지 않는 AI 액션입니다." };

  const result = await runAIAction({
    userId: user.id,
    activityId,
    action: action as AIAction,
    submissionId: submissionId ?? null,
  });

  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/");
  if (!result.ok) return { ok: false, error: result.error, reviewId: result.reviewId };
  return { ok: true, reviewId: result.reviewId };
}

/**
 * 공고 분석 결과를 사용자가 확인한 뒤 활동에 반영한다.
 * (AI가 자동 확정하지 않고, 반드시 사용자의 확인 액션을 거친다)
 */
export async function applyAnnouncementResult(
  reviewId: string,
  options: { applyDates: boolean; applyCriteria: boolean; applySummary: boolean },
): Promise<ActionResult> {
  const user = await requireUser();
  const review = db
    .select()
    .from(aiReviews)
    .where(and(eq(aiReviews.id, reviewId), eq(aiReviews.userId, user.id)))
    .get();
  if (!review || review.status !== "done" || !review.resultJson) {
    return { ok: false, error: "적용할 분석 결과를 찾을 수 없습니다." };
  }
  if (review.action !== "analyze_announcement" && review.action !== "extract_criteria") {
    return { ok: false, error: "공고 분석 결과만 적용할 수 있습니다." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(review.resultJson);
  } catch {
    return { ok: false, error: "분석 결과 형식이 손상되었습니다." };
  }
  const parsed = announcementSummarySchema.safeParse(parsedJson);
  if (!parsed.success) return { ok: false, error: "분석 결과 형식이 올바르지 않습니다." };
  const data = parsed.data;

  const activity = db
    .select()
    .from(activities)
    .where(and(eq(activities.id, review.activityId), eq(activities.userId, user.id)))
    .get();
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const applied: string[] = [];

  if (options.applyDates) {
    const updates: Partial<typeof activities.$inferInsert> = {};
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (data.keyDates.applyDeadline && dateRe.test(data.keyDates.applyDeadline)) {
      updates.applyDeadline = data.keyDates.applyDeadline;
    }
    if (data.keyDates.submitDeadline && dateRe.test(data.keyDates.submitDeadline)) {
      updates.submitDeadline = data.keyDates.submitDeadline;
    }
    if (data.keyDates.announceDate && dateRe.test(data.keyDates.announceDate)) {
      updates.announceDate = data.keyDates.announceDate;
    }
    if (Object.keys(updates).length > 0) {
      db.update(activities)
        .set({ ...updates, updatedAt: Date.now() })
        .where(eq(activities.id, activity.id))
        .run();

      // 캘린더 일정 자동 등록
      const pairs: Array<[string | null | undefined, string, string]> = [
        [updates.applyDeadline, "apply_deadline", "지원 마감"],
        [updates.submitDeadline, "final_submit", "최종 제출"],
        [updates.announceDate, "result", "결과 발표"],
      ];
      for (const [date, type, label] of pairs) {
        if (!date) continue;
        const exists = db
          .select({ id: events.id })
          .from(events)
          .where(and(eq(events.activityId, activity.id), eq(events.type, type), eq(events.date, date)))
          .get();
        if (!exists) {
          db.insert(events)
            .values({
              id: newId(),
              userId: user.id,
              activityId: activity.id,
              title: `${activity.name} ${label}`,
              type,
              date,
              createdAt: Date.now(),
            })
            .run();
        }
      }
      applied.push("주요 일정");
    }
  }

  if (options.applyCriteria && data.criteria.length > 0) {
    // 기존 기준을 유지하며 이름이 겹치지 않는 것만 추가
    const existing = db
      .select()
      .from(evaluationCriteria)
      .where(eq(evaluationCriteria.activityId, activity.id))
      .all();
    const existingNames = new Set(existing.map((c) => c.name));
    let position = existing.length;
    let added = 0;
    for (const criterion of data.criteria) {
      if (existingNames.has(criterion.name)) continue;
      db.insert(evaluationCriteria)
        .values({
          id: newId(),
          userId: user.id,
          activityId: activity.id,
          name: criterion.name,
          weight: criterion.weight,
          description: criterion.description ?? null,
          source: criterion.source,
          position: position++,
        })
        .run();
      added++;
    }
    if (added > 0) applied.push(`평가 기준 ${added}개`);
  }

  if (options.applySummary) {
    db.update(activities)
      .set({ aiSummary: review.resultJson, updatedAt: Date.now() })
      .where(eq(activities.id, activity.id))
      .run();
    applied.push("AI 요약");
  }

  if (applied.length > 0) {
    logHistory(user.id, activity.id, "ai", `공고 분석 결과 적용: ${applied.join(", ")}`);
  }

  revalidatePath(`/activities/${activity.id}`);
  revalidatePath("/calendar");
  return { ok: true };
}

/** AI 피드백(개선점)을 작업으로 등록 — "AI 분석 → 개선점 → 작업 생성" 흐름 */
export async function createTaskFromAI(
  activityId: string,
  title: string,
  reviewId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const activity = db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, user.id)))
    .get();
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const trimmed = title.trim().slice(0, 200);
  if (!trimmed) return { ok: false, error: "작업 제목이 비어 있습니다." };

  // 같은 리뷰에서 동일 제목의 작업이 이미 있으면 중복 생성 방지
  const dup = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(eq(tasks.userId, user.id), eq(tasks.sourceReviewId, reviewId), eq(tasks.title, trimmed)),
    )
    .get();
  if (dup) return { ok: false, error: "이미 같은 작업이 등록되어 있습니다." };

  const maxPos = db
    .select({ position: tasks.position })
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(desc(tasks.position))
    .get();

  const id = newId();
  const now = Date.now();
  db.insert(tasks)
    .values({
      id,
      userId: user.id,
      activityId,
      title: trimmed,
      description: "AI 리뷰 피드백에서 생성된 작업입니다.",
      priority: "high",
      status: "todo",
      position: (maxPos?.position ?? 0) + 1,
      sourceReviewId: reviewId,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  logHistory(user.id, activityId, "task", `AI 피드백에서 작업 생성: ${trimmed}`);
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/");
  return { ok: true, id };
}

// ─── 평가 기준 CRUD ─────────────────────────────────────────

export async function addCriterion(
  activityId: string,
  input: { name: string; weight: number; description?: string },
): Promise<ActionResult> {
  const user = await requireUser();
  const activity = db
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, user.id)))
    .get();
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const parsed = criteriaItemSchema.safeParse({ ...input, source: "manual" });
  if (!parsed.success) return { ok: false, error: "기준 이름과 배점을 확인해주세요." };

  const count = db
    .select({ id: evaluationCriteria.id })
    .from(evaluationCriteria)
    .where(eq(evaluationCriteria.activityId, activityId))
    .all().length;

  db.insert(evaluationCriteria)
    .values({
      id: newId(),
      userId: user.id,
      activityId,
      name: parsed.data.name,
      weight: parsed.data.weight,
      description: parsed.data.description,
      source: "manual",
      position: count,
    })
    .run();

  revalidatePath(`/activities/${activityId}`);
  return { ok: true };
}

export async function deleteCriterion(criterionId: string): Promise<ActionResult> {
  const user = await requireUser();
  const criterion = db
    .select()
    .from(evaluationCriteria)
    .where(and(eq(evaluationCriteria.id, criterionId), eq(evaluationCriteria.userId, user.id)))
    .get();
  if (!criterion) return { ok: false, error: "평가 기준을 찾을 수 없습니다." };

  db.delete(evaluationCriteria).where(eq(evaluationCriteria.id, criterionId)).run();
  revalidatePath(`/activities/${criterion.activityId}`);
  return { ok: true };
}
