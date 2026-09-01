"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, activities, aiReviews, opportunityAnalyses } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logHistory } from "@/lib/history";
import { newId, safeJsonParse } from "@/lib/utils";
import { runAIAction } from "@/services/ai/evaluator";
import { opportunityRequirementsSchema } from "@/services/ai/schemas";
import { normalizeSkillNames } from "@/services/career/skill-detect";
import { computeOpportunityFit } from "@/services/score/opportunity-fit";
import { getCareerContext } from "@/lib/career-queries";
import type { ActionResult } from "@/actions/activities";

/**
 * 공고 요구 역량 분석 + 지원 적합도 계산 파이프라인:
 * AI 추출(요구사항) → 정규화 → 규칙 기반 Fit 계산 → opportunity_analyses 저장.
 * 점수는 AI가 아니라 score 레이어가 만든다.
 */
export async function analyzeOpportunityFit(activityId: string): Promise<ActionResult> {
  const user = await requireUser();
  const activity = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, user.id)))
    .get();
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  // 1) AI 추출
  const aiResult = await runAIAction({
    userId: user.id,
    activityId,
    action: "analyze_opportunity",
  });
  if (!aiResult.ok) {
    return { ok: false, error: aiResult.error ?? "요구 역량 분석에 실패했습니다." };
  }

  const review = await db
    .select()
    .from(aiReviews)
    .where(and(eq(aiReviews.id, aiResult.reviewId), eq(aiReviews.userId, user.id)))
    .get();
  const parsed = opportunityRequirementsSchema.safeParse(
    safeJsonParse<unknown>(review?.resultJson, null),
  );
  if (!parsed.success) return { ok: false, error: "요구사항 추출 결과를 해석하지 못했습니다." };
  const requirements = {
    ...parsed.data,
    requiredSkills: normalizeSkillNames(parsed.data.requiredSkills),
    preferredSkills: normalizeSkillNames(parsed.data.preferredSkills),
  };

  // 2) 규칙 기반 Fit 계산
  const ctx = await getCareerContext(user.id);
  const fit = computeOpportunityFit({
    requirements,
    skillScores: ctx.skillScores,
    gaps: ctx.gaps,
    template: ctx.template,
  });

  // 3) 저장 (활동당 최신 1건 유지)
  await db.delete(opportunityAnalyses)
    .where(
      and(eq(opportunityAnalyses.activityId, activityId), eq(opportunityAnalyses.userId, user.id)),
    )
    .run();
  await db.insert(opportunityAnalyses)
    .values({
      id: newId(),
      userId: user.id,
      activityId,
      requirements: JSON.stringify(requirements),
      fitScore: fit.score,
      fitBreakdown: JSON.stringify({
        breakdown: fit.breakdown,
        strengths: fit.strengths,
        weaknesses: fit.weaknesses,
      }),
      recommendation: fit.recommendation,
      recommendationReason: fit.recommendationReason,
      prepHours: fit.prepHours,
      gapEffect: fit.gapEffect,
      alternative: fit.alternative ? JSON.stringify(fit.alternative) : null,
      createdAt: Date.now(),
    })
    .run();

  await logHistory(user.id, activityId, "ai", `지원 적합도 분석 완료 — ${fit.score}점 (${fit.recommendation === "apply" ? "지원 추천" : fit.recommendation === "hold" ? "보강 후 지원" : "지원 비추천"})`);

  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/opportunities");
  revalidatePath("/");
  return { ok: true, id: activityId };
}
