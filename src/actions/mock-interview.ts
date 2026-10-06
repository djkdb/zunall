"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  activities,
  careerEvidence,
  documents,
  essayDrafts,
  essayQuestions,
  interviewQuestions,
  mockInterviews,
  type MockInterviewRow,
} from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { newId } from "@/lib/utils";
import { getUsage, recordUsage, limitMessage } from "@/services/ai/usage";
import { buildProfileText } from "@/lib/career-queries";
import { getInterviewers } from "@/services/mock-interview/ai-interviewer";
import { resolveCompany } from "@/services/mock-interview/catalog";
import { getRole, resolveRole } from "@/services/mock-interview/shared/roles";
import { redactPersonalInfo } from "@/services/mock-interview/shared/documents";
import { DIFFICULTIES, EXPERIENCE_LEVELS, INTERVIEW_TYPES, LIMITS, PERSONAS } from "@/services/mock-interview/shared/schemas";
import {
  answerQuestion,
  endInterview,
  EngineError,
  reanswerQuestion,
  startInterview,
  type PanelLine,
  type Step,
} from "@/services/mock-interview/engine";
import { toRoomView, type RoomView } from "@/services/mock-interview/view";
import type { Interview } from "@/services/mock-interview/types";

/**
 * 모의 면접 (zunterview 이식).
 * - 모든 면접은 내 계정(userId)에만 속한다. 다른 사람 면접 id 로는 아무것도 할 수 없다.
 * - 프롬프트는 서버에서만 만든다. 브라우저는 정해진 설정값과 답변만 보낸다.
 * - 같은 답변이 두 번 처리되지 않게 version 으로 잠근다.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const setupSchema = z.object({
  roleId: z.string().regex(/^[a-z0-9_]{2,40}$/).optional().nullable(),
  position: z.string().trim().min(1, "직무를 골라 주세요.").max(LIMITS.position),
  companyId: z.string().regex(/^[a-z0-9-]{2,40}$/).optional().nullable(),
  companyTrack: z.string().max(20).optional().nullable(),
  interviewType: z.enum(INTERVIEW_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  questionLimit: z.number().int().min(1).max(10),
  experience: z.enum(EXPERIENCE_LEVELS),
  persona: z.enum(PERSONAS),
  activityId: z.string().max(40).optional().nullable(),
  /** 이 활동에 쓴 자기소개서로 질문받기 */
  useEssays: z.boolean().default(false),
  /** 내 커리어 근거(경험 목록)를 이력서처럼 쓰기 */
  useProfile: z.boolean().default(false),
  jobDescription: z.string().max(LIMITS.jobDescription).optional().default(""),
  voiceEnabled: z.boolean().default(false),
});
export type MockInterviewSetup = z.input<typeof setupSchema>;

async function ownedInterview(id: string, userId: string): Promise<MockInterviewRow | undefined> {
  return (
    await db
      .select()
      .from(mockInterviews)
      .where(and(eq(mockInterviews.id, id), eq(mockInterviews.userId, userId)))
      .limit(1)
  )[0];
}

function parseData(row: MockInterviewRow): Interview {
  return JSON.parse(row.data) as Interview;
}

/** 저장. 그사이 다른 요청이 먼저 저장했으면(version 이 달라졌으면) false */
async function save(row: MockInterviewRow, interview: Interview): Promise<boolean> {
  const now = Date.now();
  const done = interview.completed;
  const updated = await db
    .update(mockInterviews)
    .set({
      data: JSON.stringify(interview),
      version: row.version + 1,
      status: done ? "completed" : "active",
      overallScore: done ? interview.overallScore : null,
      updatedAt: now,
      completedAt: done ? (row.completedAt ?? now) : null,
    })
    .where(and(eq(mockInterviews.id, row.id), eq(mockInterviews.userId, row.userId), eq(mockInterviews.version, row.version)))
    .returning({ id: mockInterviews.id });
  return updated.length > 0;
}

const CONFLICT = "다른 창에서 이미 진행된 면접입니다. 화면을 새로고침해 주세요.";

/** 이 활동의 자소서(문항별 최신 답변)를 서류로 */
async function essayText(activityId: string, userId: string): Promise<string> {
  const [questions, drafts] = await Promise.all([
    db
      .select()
      .from(essayQuestions)
      .where(and(eq(essayQuestions.activityId, activityId), eq(essayQuestions.userId, userId)))
      .orderBy(asc(essayQuestions.position)),
    db.select().from(essayDrafts).where(eq(essayDrafts.userId, userId)),
  ]);
  const latest = new Map<string, (typeof drafts)[number]>();
  for (const d of [...drafts].sort((a, b) => b.version - a.version)) if (!latest.has(d.questionId)) latest.set(d.questionId, d);
  return questions
    .map((q) => {
      const a = latest.get(q.id);
      return a?.content.trim() ? `[${q.question.slice(0, 80)}]\n${a.content.trim()}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

/** 커리어 근거를 "이력서"처럼 (이름·연락처 없이 경험 목록만) */
async function profileText(userId: string): Promise<string> {
  const [summary, evidence] = await Promise.all([
    buildProfileText(userId),
    db
      .select({ title: careerEvidence.title, description: careerEvidence.description, skills: careerEvidence.skills })
      .from(careerEvidence)
      .where(eq(careerEvidence.userId, userId))
      .orderBy(desc(careerEvidence.createdAt))
      .limit(15),
  ]);
  const lines = evidence.map((e) => {
    let skills: string[] = [];
    try {
      skills = e.skills ? (JSON.parse(e.skills) as string[]) : [];
    } catch {
      skills = [];
    }
    const desc = e.description?.trim() ? ` — ${e.description.trim().slice(0, 160)}` : "";
    return `- ${e.title}${desc}${skills.length ? ` (${skills.slice(0, 4).join(", ")})` : ""}`;
  });
  return [summary, lines.length ? `경험\n${lines.join("\n")}` : ""].filter(Boolean).join("\n");
}

/** 공고문(활동에 올린 공고 문서의 텍스트) */
async function noticeText(activityId: string, userId: string): Promise<string> {
  const rows = await db
    .select({ text: documents.extractedText })
    .from(documents)
    .where(and(eq(documents.activityId, activityId), eq(documents.userId, userId), eq(documents.category, "notice")));
  return rows.map((r) => r.text ?? "").join("\n").trim();
}

const clipDoc = (s: string) => redactPersonalInfo(s).slice(0, LIMITS.document);

export async function startMockInterview(input: MockInterviewSetup): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "설정을 확인해 주세요." };
  const s = parsed.data;

  // 직무: 목록에 있는 id 만 받는다. 없으면 적은 이름으로 (비슷한 직무를 찾아 면접)
  const role = s.roleId ? getRole(s.roleId) : null;
  if (s.roleId && !role) return { ok: false, error: "직무를 다시 골라 주세요." };
  const position = role ? role.ko : s.position;

  const activity = s.activityId
    ? (
        await db
          .select()
          .from(activities)
          .where(and(eq(activities.id, s.activityId), eq(activities.userId, user.id)))
          .limit(1)
      )[0]
    : undefined;
  if (s.activityId && !activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const company = resolveCompany(s.companyId, s.companyTrack, position);
  if (s.companyId && !company) return { ok: false, error: "기업을 다시 골라 주세요." };

  const [essays, profile, notice] = await Promise.all([
    activity && s.useEssays ? essayText(activity.id, user.id) : Promise.resolve(""),
    s.useProfile ? profileText(user.id) : Promise.resolve(""),
    activity ? noticeText(activity.id, user.id) : Promise.resolve(""),
  ]);
  if (s.useEssays && !essays) return { ok: false, error: "이 활동에 쓴 자기소개서가 없습니다. 자소서를 먼저 쓰거나 이 옵션을 꺼 주세요." };
  const documentsForInterview = essays || profile ? { resume: clipDoc(profile), coverLetter: clipDoc(essays) } : undefined;
  const jobDescription = redactPersonalInfo((s.jobDescription?.trim() || notice).slice(0, LIMITS.jobDescription));

  const interviewers = await getInterviewers();
  if (interviewers.real) {
    // 면접 한 번을 AI 사용 1회로 센다 (면접 안의 호출 수는 엔진이 따로 상한을 둔다)
    const usage = await getUsage(user.id);
    if (usage.exceeded) return { ok: false, error: limitMessage(usage) };
    await recordUsage(user.id);
  }

  const now = Date.now();
  const id = newId();
  const base: Interview = {
    id,
    createdAt: now,
    config: {
      position,
      experience: s.experience,
      interviewType: s.interviewType,
      difficulty: s.difficulty,
      questionLimit: s.questionLimit,
      jobDescription,
      persona: s.persona,
      language: "ko",
      ...(role ? { roleId: role.id } : {}),
      ...(company ? { companyId: company.company.id, companyTrack: company.track } : {}),
      ...(documentsForInterview ? { documents: documentsForInterview } : {}),
      answerTimeLimit: 0,
      voiceEnabled: s.voiceEnabled,
      liveFeedback: false,
    },
    questions: [],
    overallScore: null,
    categoryScores: null,
    report: null,
    duration: 0,
    completed: false,
    endedEarly: false,
    providers: [],
  };

  // 목록에 없는 직무("방송 기술감독"): AI 가 있으면 연습용 직무 프로필을 추정한다 (실패해도 진행)
  if (!role && interviewers.ai?.inferRole && resolveRole(position).kind !== "role") {
    const custom = await interviewers.ai.inferRole(position, "ko").catch(() => null);
    if (custom) base.config.customRole = custom;
  }

  let step: Step;
  try {
    step = await startInterview(base, interviewers);
  } catch (error) {
    console.error("[mock-interview] start failed", error);
    return { ok: false, error: "면접을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  await db.insert(mockInterviews).values({
    id,
    userId: user.id,
    activityId: activity?.id ?? null,
    position,
    companyName: company?.company.name ?? null,
    status: "active",
    overallScore: null,
    data: JSON.stringify(step.interview),
    version: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });

  revalidatePath("/interview");
  return { ok: true, id };
}

const answerSchema = z.object({
  questionId: z.string().min(1).max(60),
  answer: z.string().trim().min(1, "답변을 입력해 주세요.").max(LIMITS.answer, `답변은 ${LIMITS.answer}자까지 쓸 수 있습니다.`),
  mode: z.enum(["text", "voice"]),
  durationSec: z.number().min(0).max(3600),
});

export interface StepResult {
  lines: PanelLine[];
  finished: boolean;
  view: RoomView;
}

export async function answerMockInterview(id: string, input: z.input<typeof answerSchema>): Promise<Result<StepResult>> {
  const user = await requireUser();
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "답변을 확인해 주세요." };
  const row = await ownedInterview(id, user.id);
  if (!row) return { ok: false, error: "면접을 찾을 수 없습니다." };
  if (row.status === "completed") return { ok: false, error: "이미 끝난 면접입니다." };

  let step: Step;
  try {
    step = await answerQuestion(parseData(row), parsed.data, await getInterviewers());
  } catch (error) {
    if (error instanceof EngineError) return { ok: false, error: error.message };
    console.error("[mock-interview] answer failed", error);
    return { ok: false, error: "답변을 처리하지 못했습니다. 다시 보내 주세요." };
  }
  if (!(await save(row, step.interview))) return { ok: false, error: CONFLICT };
  if (step.finished) revalidatePath("/interview");
  return { ok: true, lines: step.lines, finished: step.finished, view: toRoomView(step.interview, row) };
}

export async function endMockInterview(id: string): Promise<Result> {
  const user = await requireUser();
  const row = await ownedInterview(id, user.id);
  if (!row) return { ok: false, error: "면접을 찾을 수 없습니다." };
  if (row.status === "completed") return { ok: true };
  const interview = parseData(row);
  if (!interview.questions.some((q) => q.answer)) {
    // 한 문제도 답하지 않았으면 기록으로 남길 게 없다
    await db.delete(mockInterviews).where(and(eq(mockInterviews.id, id), eq(mockInterviews.userId, user.id)));
    revalidatePath("/interview");
    return { ok: true };
  }
  const step = await endInterview(interview, await getInterviewers());
  if (!(await save(row, step.interview))) return { ok: false, error: CONFLICT };
  revalidatePath("/interview");
  return { ok: true };
}

const reanswerSchema = z.object({
  questionId: z.string().min(1).max(60),
  answer: z.string().trim().min(1, "답변을 입력해 주세요.").max(LIMITS.answer),
});

export async function reanswerMockInterview(
  id: string,
  input: z.input<typeof reanswerSchema>,
): Promise<Result<{ score: number; before: number | null }>> {
  const user = await requireUser();
  const parsed = reanswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "답변을 확인해 주세요." };
  const row = await ownedInterview(id, user.id);
  if (!row || row.status !== "completed") return { ok: false, error: "면접을 찾을 수 없습니다." };
  const interview = parseData(row);
  const original = interview.questions.find((q) => q.id === parsed.data.questionId);
  if (!original) return { ok: false, error: "질문을 찾을 수 없습니다." };

  const interviewers = await getInterviewers();
  if (interviewers.real) {
    const usage = await getUsage(user.id);
    if (usage.exceeded) return { ok: false, error: limitMessage(usage) };
    await recordUsage(user.id);
  }
  try {
    const { interview: next, reanswer } = await reanswerQuestion(interview, parsed.data.questionId, parsed.data.answer, interviewers);
    if (!(await save(row, next))) return { ok: false, error: CONFLICT };
    revalidatePath(`/interview/${id}`);
    return { ok: true, score: reanswer.score, before: original.score };
  } catch (error) {
    if (error instanceof EngineError) return { ok: false, error: error.message };
    console.error("[mock-interview] reanswer failed", error);
    return { ok: false, error: "다시 채점하지 못했습니다." };
  }
}

export async function deleteMockInterview(id: string): Promise<Result> {
  const user = await requireUser();
  const row = await ownedInterview(id, user.id);
  if (!row) return { ok: false, error: "면접을 찾을 수 없습니다." };
  await db.delete(mockInterviews).where(and(eq(mockInterviews.id, id), eq(mockInterviews.userId, user.id)));
  revalidatePath("/interview");
  if (row.activityId) revalidatePath(`/activities/${row.activityId}`);
  return { ok: true };
}

/**
 * 면접에서 받은 질문(과 내 답)을 그 활동의 "면접 준비" 목록에 담는다.
 * 실제 면접 전에 답변 스크립트를 다듬을 수 있게.
 */
export async function saveQuestionToPrep(id: string, questionId: string): Promise<Result> {
  const user = await requireUser();
  const row = await ownedInterview(id, user.id);
  if (!row) return { ok: false, error: "면접을 찾을 수 없습니다." };
  if (!row.activityId) return { ok: false, error: "활동과 연결된 면접에서만 담을 수 있습니다." };
  const activity = (
    await db
      .select({ id: activities.id })
      .from(activities)
      .where(and(eq(activities.id, row.activityId), eq(activities.userId, user.id)))
      .limit(1)
  )[0];
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const interview = parseData(row);
  const q = interview.questions.find((x) => x.id === questionId);
  if (!q) return { ok: false, error: "질문을 찾을 수 없습니다." };
  // 다시 답한 게 있으면 더 나은 쪽을 담는다
  const re = [...(interview.reanswers ?? [])].reverse().find((r) => r.questionId === questionId);
  const best = re && re.score > (q.score ?? 0) ? re.answer : q.answer;

  const existing = await db
    .select({ id: interviewQuestions.id, question: interviewQuestions.question })
    .from(interviewQuestions)
    .where(and(eq(interviewQuestions.activityId, activity.id), eq(interviewQuestions.userId, user.id)));
  if (existing.some((e) => e.question.trim() === q.text.trim())) return { ok: true };

  const now = Date.now();
  await db.insert(interviewQuestions).values({
    id: newId(),
    userId: user.id,
    activityId: activity.id,
    question: q.text.slice(0, 500),
    why: (q.followUpReason ?? "").slice(0, 500) || null,
    hint: q.feedback?.improve.slice(0, 500) || null,
    answer: best?.slice(0, 5000) || null,
    ready: 0,
    source: "manual",
    position: existing.length,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath(`/activities/${activity.id}`);
  return { ok: true };
}
