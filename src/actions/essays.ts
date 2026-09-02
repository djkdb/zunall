"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, activities, essayQuestions, essayDrafts, evaluationCriteria, documents } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logHistory } from "@/lib/history";
import { newId } from "@/lib/utils";
import { getProvider, type AIContext, type AIRequest } from "@/services/ai/provider";
import { buildPrompt } from "@/services/ai/prompt-builder";
import { completeWithRetry } from "@/services/ai/evaluator";
import { buildProfileText } from "@/lib/career-queries";
import type { ActionResult } from "@/actions/activities";

const questionSchema = z.object({
  activityId: z.string().min(1),
  question: z.string().trim().min(2, "문항을 입력해주세요.").max(500),
  charLimit: z
    .union([z.coerce.number().int().min(50).max(20000), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : (v as number))),
  guide: z.string().trim().max(500).optional(),
});

async function ownedActivity(activityId: string, userId: string) {
  return (
    await db
      .select()
      .from(activities)
      .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
      .limit(1)
  )[0];
}

async function ownedQuestion(questionId: string, userId: string) {
  return (
    await db
      .select()
      .from(essayQuestions)
      .where(and(eq(essayQuestions.id, questionId), eq(essayQuestions.userId, userId)))
      .limit(1)
  )[0];
}

export async function addEssayQuestion(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = questionSchema.safeParse({
    activityId: formData.get("activityId"),
    question: formData.get("question"),
    charLimit: formData.get("charLimit") ?? "",
    guide: formData.get("guide") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const activity = await ownedActivity(parsed.data.activityId, user.id);
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const existing = await db
    .select({ id: essayQuestions.id })
    .from(essayQuestions)
    .where(eq(essayQuestions.activityId, activity.id));

  const id = newId();
  await db.insert(essayQuestions).values({
    id,
    userId: user.id,
    activityId: activity.id,
    question: parsed.data.question,
    charLimit: parsed.data.charLimit,
    guide: parsed.data.guide || null,
    position: existing.length,
    createdAt: Date.now(),
  });

  await logHistory(user.id, activity.id, "submission", `자소서 문항 추가: ${parsed.data.question.slice(0, 40)}`);
  revalidatePath(`/activities/${activity.id}`);
  return { ok: true, id };
}

export async function deleteEssayQuestion(questionId: string): Promise<ActionResult> {
  const user = await requireUser();
  const question = await ownedQuestion(questionId, user.id);
  if (!question) return { ok: false, error: "문항을 찾을 수 없습니다." };

  await db.delete(essayDrafts).where(eq(essayDrafts.questionId, questionId));
  await db.delete(essayQuestions).where(eq(essayQuestions.id, questionId));
  revalidatePath(`/activities/${question.activityId}`);
  return { ok: true, id: questionId };
}

/** 답변 저장 (버전이 하나씩 쌓인다) */
export async function saveEssayDraft(
  questionId: string,
  content: string,
): Promise<ActionResult & { version?: number }> {
  const user = await requireUser();
  const question = await ownedQuestion(questionId, user.id);
  if (!question) return { ok: false, error: "문항을 찾을 수 없습니다." };
  if (!content.trim()) return { ok: false, error: "답변을 입력해주세요." };

  const latest = (
    await db
      .select()
      .from(essayDrafts)
      .where(eq(essayDrafts.questionId, questionId))
      .orderBy(desc(essayDrafts.version))
      .limit(1)
  )[0];

  const id = newId();
  const version = (latest?.version ?? 0) + 1;
  await db.insert(essayDrafts).values({
    id,
    userId: user.id,
    questionId,
    version,
    content: content.slice(0, 20000),
    createdAt: Date.now(),
  });

  revalidatePath(`/activities/${question.activityId}`);
  return { ok: true, id, version };
}

/** 저장된 최신 답변을 AI 로 첨삭한다 */
export async function coachEssayDraft(draftId: string): Promise<ActionResult> {
  const user = await requireUser();
  const draft = (
    await db
      .select()
      .from(essayDrafts)
      .where(and(eq(essayDrafts.id, draftId), eq(essayDrafts.userId, user.id)))
      .limit(1)
  )[0];
  if (!draft) return { ok: false, error: "초안을 찾을 수 없습니다." };

  const question = await ownedQuestion(draft.questionId, user.id);
  if (!question) return { ok: false, error: "문항을 찾을 수 없습니다." };
  const activity = await ownedActivity(question.activityId, user.id);
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const criteria = await db
    .select()
    .from(evaluationCriteria)
    .where(eq(evaluationCriteria.activityId, activity.id))
    .orderBy(asc(evaluationCriteria.position));

  const notice = (
    await db
      .select({ text: documents.extractedText })
      .from(documents)
      .where(and(eq(documents.activityId, activity.id), eq(documents.category, "notice")))
      .orderBy(desc(documents.createdAt))
      .limit(1)
  )[0];

  const chars = draft.content.replace(/\s/g, "").length;
  const ctx: AIContext = {
    activityName: activity.name,
    activityType: activity.type,
    organizer: activity.organizer,
    criteria: criteria.map((c) => ({
      name: c.name,
      weight: c.weight,
      source: c.source,
      description: c.description,
    })),
    announcementText: notice?.text ?? "",
    submissionText: draft.content,
    submissionTitle: question.question,
    userProfile: await buildProfileText(user.id),
    extraInstruction: [
      `문항: ${question.question}`,
      question.charLimit ? `글자수 제한: ${question.charLimit}자` : "글자수 제한: 없음",
      `현재 글자수(공백 제외): ${chars}자`,
      question.guide ? `작성 가이드: ${question.guide}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };

  try {
    const provider = await getProvider();
    const request: AIRequest = { action: "essay_coach", prompt: buildPrompt("essay_coach", ctx), context: ctx };
    const parsed = await completeWithRetry(provider, request);
    if (parsed.kind !== "essay") return { ok: false, error: "첨삭 결과 형식이 올바르지 않습니다." };

    await db
      .update(essayDrafts)
      .set({ feedbackJson: JSON.stringify(parsed.data), score: parsed.data.score })
      .where(eq(essayDrafts.id, draft.id));

    await logHistory(
      user.id,
      activity.id,
      "ai",
      `자소서 첨삭 (v${draft.version}): ${parsed.data.score}점`,
    );
    revalidatePath(`/activities/${activity.id}`);
    return { ok: true, id: draft.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "첨삭 중 오류가 발생했습니다.",
    };
  }
}
