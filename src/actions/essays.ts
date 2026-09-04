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
import { getUsage, recordUsage, limitMessage } from "@/services/ai/usage";
import { buildProfileText } from "@/lib/career-queries";
import type { ActionResult } from "@/actions/activities";
import { classifyQuestion, parseTopic, topicOf, ESSAY_TOPICS } from "@/services/essay/topics";

const questionSchema = z.object({
  activityId: z.string().min(1),
  question: z.string().trim().min(2, "문항을 입력해주세요.").max(500),
  charLimit: z
    .union([z.coerce.number().int().min(50).max(20000), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : (v as number))),
  guide: z.string().trim().max(500).optional(),
  topic: z.string().max(30).optional(),
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
    topic: formData.get("topic") ?? "",
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
    // 고르지 않았으면 문항 문장에서 유형을 추측한다 (나중에 바꿀 수 있다)
    topic: parseTopic(parsed.data.topic) ?? classifyQuestion(parsed.data.question).topic,
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
    // 하루 상한을 넘었으면 AI 를 부르지 않는다
    const usage = await getUsage(user.id);
    if (usage.exceeded) return { ok: false, error: limitMessage(usage) };
    await recordUsage(user.id);
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

/** 문항 유형 바꾸기 (자동 분류가 어긋났을 때) */
export async function setEssayTopic(questionId: string, topic: string): Promise<ActionResult> {
  const user = await requireUser();
  const question = await ownedQuestion(questionId, user.id);
  if (!question) return { ok: false, error: "문항을 찾을 수 없습니다." };
  if (!(topic in ESSAY_TOPICS)) return { ok: false, error: "알 수 없는 유형입니다." };

  await db.update(essayQuestions).set({ topic }).where(eq(essayQuestions.id, questionId));
  revalidatePath(`/activities/${question.activityId}`);
  revalidatePath("/essays");
  return { ok: true, id: questionId };
}

export interface SimilarAnswer {
  questionId: string;
  question: string;
  activityId: string;
  activityName: string;
  content: string;
  version: number;
  createdAt: number;
}

/**
 * 같은 유형의 다른 문항에 예전에 쓴 답변을 찾아준다.
 * 자소서에서 가장 오래 걸리는 일이 "그때 뭐라고 썼더라"를 찾는 것이다.
 */
export async function findSimilarAnswers(questionId: string, limit = 5): Promise<SimilarAnswer[]> {
  const user = await requireUser();
  const question = await ownedQuestion(questionId, user.id);
  if (!question) return [];

  const target = topicOf(question);

  const [questions, drafts, acts] = await Promise.all([
    db.select().from(essayQuestions).where(eq(essayQuestions.userId, user.id)),
    db
      .select()
      .from(essayDrafts)
      .where(eq(essayDrafts.userId, user.id))
      .orderBy(desc(essayDrafts.version)),
    db
      .select({ id: activities.id, name: activities.name })
      .from(activities)
      .where(eq(activities.userId, user.id)),
  ]);

  const activityName = new Map(acts.map((a) => [a.id, a.name]));
  const sameTopic = questions.filter((q) => q.id !== questionId && topicOf(q) === target);
  if (sameTopic.length === 0) return [];

  // 문항마다 가장 최신 버전 하나만 (버전 내림차순으로 읽었으니 처음 만난 것이 최신)
  const latest = new Map<string, (typeof drafts)[number]>();
  for (const draft of drafts) {
    if (!latest.has(draft.questionId)) latest.set(draft.questionId, draft);
  }

  return sameTopic
    .map((q) => {
      const draft = latest.get(q.id);
      if (!draft || !draft.content.trim()) return null;
      return {
        questionId: q.id,
        question: q.question,
        activityId: q.activityId,
        activityName: activityName.get(q.activityId) ?? "삭제된 활동",
        content: draft.content,
        version: draft.version,
        createdAt: draft.createdAt,
      };
    })
    .filter((item): item is SimilarAnswer => item !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
