"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, activities, documents, aiReviews } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { saveFile } from "@/lib/storage";
import { fetchNotice } from "@/services/document/fetch-url";
import { guessActivityType, guessOrganizer, guessTitle } from "@/services/ai/mock.provider";
import { runAIAction } from "@/services/ai/evaluator";
import { applyAnnouncementResult } from "@/actions/ai";
import { announcementSummarySchema } from "@/services/ai/schemas";
import { logHistory } from "@/lib/history";
import { newId } from "@/lib/utils";
import { ACTIVITY_TYPES } from "@/lib/constants";

export interface QuickCreateResult {
  ok: boolean;
  error?: string;
  activityId?: string;
  /** 사용자에게 무엇이 자동으로 채워졌는지 알려준다 */
  filled?: string[];
}

/**
 * 링크나 공고문 한 덩어리로 활동을 만든다.
 *
 * 입력 항목이 많아 등록 자체가 부담이라는 문제를 없애는 것이 목적이다.
 * 공고 텍스트를 확보 → 활동 생성 → 공고 문서로 저장 → AI 분석 →
 * 마감일·평가 기준·요약을 자동 반영까지 한 번에 처리한다.
 */
export async function quickCreateActivity(input: {
  url?: string;
  text?: string;
}): Promise<QuickCreateResult> {
  const user = await requireUser();
  const url = (input.url ?? "").trim();
  const pasted = (input.text ?? "").trim();

  let noticeText = pasted;
  let sourceTitle = "";

  if (url) {
    const fetched = await fetchNotice(url);
    if (!fetched.ok) return { ok: false, error: fetched.error ?? "링크를 읽지 못했습니다." };
    noticeText = fetched.text;
    sourceTitle = fetched.title;
  }

  if (noticeText.replace(/\s/g, "").length < 50) {
    return {
      ok: false,
      error: "공고 내용이 너무 짧습니다. 공고문 전체를 붙여넣거나 링크를 넣어주세요.",
    };
  }

  const filled: string[] = [];
  const name =
    (guessTitle(noticeText) || sourceTitle || "새 활동").replace(/\s+/g, " ").slice(0, 120);
  const organizer = guessOrganizer(noticeText);
  const type = guessActivityType(noticeText);
  filled.push(`활동명 "${name}"`);
  if (organizer) filled.push(`주최 "${organizer}"`);
  filled.push(`종류 ${ACTIVITY_TYPES[type as keyof typeof ACTIVITY_TYPES] ?? type}`);

  const now = Date.now();
  const activityId = newId();
  await db.insert(activities).values({
    id: activityId,
    userId: user.id,
    name,
    organizer,
    type,
    status: "interested",
    link: url || null,
    createdAt: now,
    updatedAt: now,
  });
  await logHistory(user.id, activityId, "created", url ? `링크로 활동 생성: ${url.slice(0, 120)}` : "공고문 붙여넣기로 활동 생성");

  // 공고 원문을 문서로 남겨 AI 분석·재확인에 쓴다
  const fileName = `${name.slice(0, 60)} 공고.txt`;
  const file = new File([noticeText], fileName, { type: "text/plain" });
  try {
    const stored = await saveFile(user.id, file);
    await db.insert(documents).values({
      id: newId(),
      userId: user.id,
      activityId,
      category: "notice",
      name: fileName,
      originalName: fileName,
      mime: "text/plain",
      size: stored.size,
      storagePath: stored.storagePath,
      description: url ? `링크에서 가져옴: ${url.slice(0, 300)}` : "붙여넣은 공고문",
      version: 1,
      groupId: newId(),
      extractedText: noticeText.slice(0, 200_000),
      createdAt: now,
    });
    filled.push("공고문 저장");
  } catch {
    // 문서 저장이 실패해도 활동은 남긴다
  }

  // 공고 분석 → 마감일·평가 기준·요약 자동 반영
  const analysis = await runAIAction({ userId: user.id, activityId, action: "analyze_announcement" });
  if (analysis.ok) {
    const applied = await applyAnnouncementResult(analysis.reviewId, {
      applyDates: true,
      applyCriteria: true,
      applySummary: true,
    });
    if (applied.ok) {
      const review = (
        await db
          .select()
          .from(aiReviews)
          .where(and(eq(aiReviews.id, analysis.reviewId), eq(aiReviews.userId, user.id)))
          .orderBy(desc(aiReviews.createdAt))
          .limit(1)
      )[0];
      const parsed = review?.resultJson
        ? announcementSummarySchema.safeParse(JSON.parse(review.resultJson))
        : null;
      if (parsed?.success) {
        const dates = [
          parsed.data.keyDates.applyDeadline && "지원 마감일",
          parsed.data.keyDates.submitDeadline && "제출 마감일",
          parsed.data.keyDates.announceDate && "발표일",
        ].filter(Boolean) as string[];
        if (dates.length > 0) filled.push(dates.join("·"));
        if (parsed.data.criteria.length > 0) filled.push(`평가 기준 ${parsed.data.criteria.length}개`);
        if (parsed.data.requirements.length > 0)
          filled.push(`제출물 ${parsed.data.requirements.length}개`);
      }
    }
  }

  revalidatePath("/activities");
  return { ok: true, activityId, filled };
}
