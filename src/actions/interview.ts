"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  activities,
  essayQuestions,
  essayDrafts,
  evaluationCriteria,
  documents,
  interviewQuestions,
} from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { newId } from "@/lib/utils";
import { getProvider, type AIContext, type AIRequest } from "@/services/ai/provider";
import { buildPrompt } from "@/services/ai/prompt-builder";
import { completeWithRetry } from "@/services/ai/evaluator";
import { getUsage, recordUsage, limitMessage } from "@/services/ai/usage";
import { buildProfileText } from "@/lib/career-queries";
import type { ActionResult } from "@/actions/activities";

/**
 * 면접 준비.
 * 서류까지는 앱이 챙겨주는데 그다음이 비어 있었다.
 * 내가 쓴 자소서와 공고를 근거로 질문을 만들고, 답변 스크립트를 남긴다.
 */

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
      .from(interviewQuestions)
      .where(and(eq(interviewQuestions.id, questionId), eq(interviewQuestions.userId, userId)))
      .limit(1)
  )[0];
}

/** 공고 + 내 자소서 답변으로 예상 질문을 만든다 */
export async function generateInterviewQuestions(activityId: string): Promise<ActionResult> {
  const user = await requireUser();
  const activity = await ownedActivity(activityId, user.id);
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const [criteria, notices, questions, drafts, profileText, existing] = await Promise.all([
    db
      .select()
      .from(evaluationCriteria)
      .where(eq(evaluationCriteria.activityId, activityId))
      .orderBy(asc(evaluationCriteria.position)),
    db
      .select()
      .from(documents)
      .where(and(eq(documents.activityId, activityId), eq(documents.category, "notice"))),
    db.select().from(essayQuestions).where(eq(essayQuestions.activityId, activityId)),
    db.select().from(essayDrafts).where(eq(essayDrafts.userId, user.id)),
    buildProfileText(user.id),
    db.select().from(interviewQuestions).where(eq(interviewQuestions.activityId, activityId)),
  ]);

  // 이 활동의 자소서 문항별 최신 답변을 모아 "지원자가 쓴 글"로 넘긴다
  const latest = new Map<string, (typeof drafts)[number]>();
  for (const draft of [...drafts].sort((a, b) => b.version - a.version)) {
    if (!latest.has(draft.questionId)) latest.set(draft.questionId, draft);
  }
  const essayText = questions
    .map((q) => {
      const answer = latest.get(q.id);
      return answer ? `[문항] ${q.question}\n${answer.content}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  const context: AIContext = {
    activityName: activity.name,
    activityType: activity.type,
    organizer: activity.organizer,
    criteria: criteria.map((c) => ({
      name: c.name,
      weight: c.weight,
      source: c.source,
      description: c.description,
    })),
    announcementText: notices.map((d) => d.extractedText ?? "").join("\n").slice(0, 8000),
    submissionText: essayText,
    submissionTitle: null,
    userProfile: profileText,
  };

  const request: AIRequest = {
    action: "interview_questions",
    prompt: buildPrompt("interview_questions", context),
    context,
  };

  const provider = await getProvider();
  // 하루 상한을 넘었으면 AI 를 부르지 않는다
  const usage = await getUsage(user.id);
  if (usage.exceeded) return { ok: false, error: limitMessage(usage) };
  await recordUsage(user.id);
  const result = await completeWithRetry(provider, request);
  if (result.kind !== "interview") return { ok: false, error: "질문을 만들지 못했습니다." };

  // 이미 있는 질문과 겹치지 않게 (직접 적은 질문과 답변은 보존한다)
  const known = new Set(existing.map((q) => q.question.trim()));
  const fresh = result.data.questions.filter((q) => q.question.trim() && !known.has(q.question.trim()));
  if (fresh.length === 0) return { ok: true, id: activityId };

  const now = Date.now();
  await db.insert(interviewQuestions).values(
    fresh.map((q, index) => ({
      id: newId(),
      userId: user.id,
      activityId,
      question: q.question.slice(0, 500),
      why: q.why?.slice(0, 500) || null,
      hint: q.hint?.slice(0, 500) || null,
      answer: null,
      ready: 0,
      source: "ai",
      position: existing.length + index,
      createdAt: now,
      updatedAt: now,
    })),
  );

  revalidatePath(`/activities/${activityId}`);
  return { ok: true, id: activityId };
}

const manualSchema = z.object({
  activityId: z.string().min(1),
  question: z.string().trim().min(2, "질문을 입력해주세요.").max(500),
});

/** 직접 질문 추가 (면접에서 실제로 받은 질문을 기록해두기 좋다) */
export async function addInterviewQuestion(input: z.input<typeof manualSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const activity = await ownedActivity(parsed.data.activityId, user.id);
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const existing = await db
    .select({ id: interviewQuestions.id })
    .from(interviewQuestions)
    .where(eq(interviewQuestions.activityId, activity.id));

  const now = Date.now();
  const id = newId();
  await db.insert(interviewQuestions).values({
    id,
    userId: user.id,
    activityId: activity.id,
    question: parsed.data.question,
    source: "manual",
    position: existing.length,
    ready: 0,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath(`/activities/${activity.id}`);
  return { ok: true, id };
}

/** 답변 스크립트 저장 */
export async function saveInterviewAnswer(questionId: string, answer: string): Promise<ActionResult> {
  const user = await requireUser();
  const question = await ownedQuestion(questionId, user.id);
  if (!question) return { ok: false, error: "질문을 찾을 수 없습니다." };
  if (answer.length > 5000) return { ok: false, error: "답변이 너무 깁니다." };

  await db
    .update(interviewQuestions)
    .set({ answer: answer.trim() || null, updatedAt: Date.now() })
    .where(eq(interviewQuestions.id, questionId));

  revalidatePath(`/activities/${question.activityId}`);
  return { ok: true, id: questionId };
}

/** 준비 완료 표시 */
export async function toggleInterviewReady(questionId: string): Promise<ActionResult> {
  const user = await requireUser();
  const question = await ownedQuestion(questionId, user.id);
  if (!question) return { ok: false, error: "질문을 찾을 수 없습니다." };

  await db
    .update(interviewQuestions)
    .set({ ready: question.ready === 1 ? 0 : 1, updatedAt: Date.now() })
    .where(eq(interviewQuestions.id, questionId));

  revalidatePath(`/activities/${question.activityId}`);
  return { ok: true, id: questionId };
}

export async function deleteInterviewQuestion(questionId: string): Promise<ActionResult> {
  const user = await requireUser();
  const question = await ownedQuestion(questionId, user.id);
  if (!question) return { ok: false, error: "질문을 찾을 수 없습니다." };

  await db.delete(interviewQuestions).where(eq(interviewQuestions.id, questionId));
  revalidatePath(`/activities/${question.activityId}`);
  return { ok: true, id: questionId };
}
