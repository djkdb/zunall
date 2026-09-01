import "server-only";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  activities,
  documents,
  evaluationCriteria,
  aiReviews,
  aiReviewItems,
  submissions,
  users,
  careerGoals,
  careerProfiles,
} from "@/lib/db";
import { logHistory, pushNotification } from "@/lib/history";
import { newId, daysUntil, safeJsonParse } from "@/lib/utils";
import { getLatestVersionDocument } from "@/lib/queries";
import { AI_ACTIONS, type AIAction } from "@/lib/constants";
import { getProvider, type AIContext, type AIRequest } from "./provider";
import { buildPrompt, buildRetryPrompt } from "./prompt-builder";
import { extractJson } from "./parse-json";
import {
  announcementSummarySchema,
  evaluationResultSchema,
  finalCheckSchema,
  adviceResultSchema,
  opportunityRequirementsSchema,
  type AIResultData,
} from "./schemas";

export interface RunAIParams {
  userId: string;
  activityId: string;
  action: AIAction;
  submissionId?: string | null;
}

export interface RunAIResult {
  ok: boolean;
  reviewId: string;
  error?: string;
}

/**
 * AI 액션 실행 파이프라인:
 * 컨텍스트 수집 → 프롬프트 생성 → provider 실행 → JSON 추출/검증(재시도 포함) → 저장/알림
 */
export async function runAIAction(params: RunAIParams): Promise<RunAIResult> {
  const { userId, activityId, action } = params;

  const activity = db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .get();
  if (!activity) return { ok: false, reviewId: "", error: "활동을 찾을 수 없습니다." };

  const context = buildContext(userId, activity, params.submissionId ?? null, action);
  if ("error" in context) return { ok: false, reviewId: "", error: context.error };

  const provider = await getProvider();
  const reviewId = newId();
  db.insert(aiReviews)
    .values({
      id: reviewId,
      userId,
      activityId,
      submissionId: params.submissionId ?? null,
      submissionVersionId: context.versionId,
      action,
      provider: provider.name,
      status: "running",
      createdAt: Date.now(),
    })
    .run();

  try {
    const prompt = buildPrompt(action, context.ctx);
    const request: AIRequest = { action, prompt, context: context.ctx };
    const parsed = await completeWithRetry(provider, request);
    persistResult(reviewId, userId, activity.id, activity.name, action, parsed, params.submissionId ?? null);
    return { ok: true, reviewId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI 실행 중 알 수 없는 오류가 발생했습니다.";
    db.update(aiReviews)
      .set({ status: "error", errorMessage: message, completedAt: Date.now() })
      .where(eq(aiReviews.id, reviewId))
      .run();
    pushNotification({
      userId,
      activityId,
      type: "ai",
      title: "AI 실행 실패",
      body: `${AI_ACTIONS[action]} — ${message}`,
    });
    return { ok: false, reviewId, error: message };
  }
}

// ─── 컨텍스트 수집 ───────────────────────────────────────────

type ContextResult =
  | { ctx: AIContext; versionId: string | null }
  | { error: string };

function buildContext(
  userId: string,
  activity: typeof activities.$inferSelect,
  submissionId: string | null,
  action: AIAction,
): ContextResult {
  // 평가 기준
  const criteria = db
    .select()
    .from(evaluationCriteria)
    .where(eq(evaluationCriteria.activityId, activity.id))
    .orderBy(evaluationCriteria.position)
    .all()
    .map((c) => ({
      name: c.name,
      weight: c.weight,
      source: c.source,
      description: c.description,
    }));

  // 공고/안내 문서 텍스트
  const noticeDocs = db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.activityId, activity.id),
        eq(documents.userId, userId),
        eq(documents.category, "notice"),
      ),
    )
    .orderBy(desc(documents.createdAt))
    .all();
  const announcementText = noticeDocs
    .filter((d) => d.extractedText)
    .map((d) => `《${d.name}》\n${d.extractedText}`)
    .join("\n\n---\n\n");

  if ((action === "analyze_announcement" || action === "extract_criteria") && !announcementText.trim()) {
    return {
      error:
        "분석할 공고 문서가 없습니다. Documents 탭에서 '공고 / 안내' 분류로 텍스트 추출 가능한 파일(PDF, DOCX 등)을 먼저 업로드해주세요.",
    };
  }

  // 제출물 텍스트
  let submissionText = "";
  let submissionTitle: string | null = null;
  let versionId: string | null = null;
  let extraInstruction: string | undefined;

  const needsSubmission = ["evaluate_submission", "final_check", "proofread", "improvements", "expected_questions"].includes(action);

  if (submissionId) {
    const submission = db
      .select()
      .from(submissions)
      .where(and(eq(submissions.id, submissionId), eq(submissions.userId, userId)))
      .get();
    if (!submission) return { error: "제출물을 찾을 수 없습니다." };
    submissionTitle = submission.title;

    const latest = getLatestVersionDocument(submissionId, userId);
    if (!latest) {
      return { error: "제출물에 업로드된 파일이 없습니다. 먼저 버전 파일을 업로드해주세요." };
    }
    versionId = latest.version.id;
    submissionText = latest.doc.extractedText ?? "";
    if (!submissionText.trim() && action !== "final_check") {
      return {
        error: `"${latest.doc.originalName}" 파일에서 텍스트를 추출하지 못했습니다. PDF/DOCX/PPTX/TXT 형식의 파일을 업로드해주세요.`,
      };
    }

    if (action === "final_check") {
      const flags: string[] = [];
      const maxSize = 20 * 1024 * 1024;
      if (latest.doc.size > maxSize) flags.push("SIZE_OVER");
      const days = daysUntil(submission.dueDate ?? activity.submitDeadline);
      if (days !== null && days < 0) flags.push("DEADLINE_PASSED");
      else if (days !== null && days <= 2) flags.push("DEADLINE_SOON");
      // 플래그는 [대괄호] 형태로만 표기한다 — mock provider가 substring 검사로 판별하므로
      // 설명 문구에 플래그 토큰이 그대로 들어가면 오탐이 발생한다.
      extraInstruction = `파일명: ${latest.doc.originalName}, 크기: ${(latest.doc.size / 1024 / 1024).toFixed(2)}MB, 형식: ${latest.doc.mime}. 상태 플래그: ${flags.length > 0 ? flags.map((f) => `[${f}]`).join(" ") : "(문제 없음)"}. 플래그 의미 — SIZE_OVER: 파일 크기 초과, DEADLINE_PASSED: 마감 지남, DEADLINE_SOON: 마감 임박.`;
    }
  } else if (needsSubmission && action !== "expected_questions") {
    return { error: "이 액션은 제출물을 선택해야 합니다." };
  } else {
    // 제출물이 없는 액션(적합도 분석 등)은 '내가 만든 자료'를 참고 자료로 활용
    const workDocs = db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.activityId, activity.id),
          eq(documents.userId, userId),
          eq(documents.category, "work"),
        ),
      )
      .orderBy(desc(documents.createdAt))
      .all();
    submissionText = workDocs
      .filter((d) => d.extractedText)
      .map((d) => `《${d.name}》\n${d.extractedText}`)
      .join("\n\n---\n\n");
  }

  // 지원자 프로필: 이름 + 활동 이력 + 커리어 목표/헤드라인 (있으면)
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  const myActivities = db
    .select({ name: activities.name, type: activities.type, status: activities.status })
    .from(activities)
    .where(eq(activities.userId, userId))
    .all();
  const wonCount = myActivities.filter((a) => a.status === "won").length;
  const careerGoal = db
    .select({ name: careerGoals.name })
    .from(careerGoals)
    .where(and(eq(careerGoals.userId, userId), eq(careerGoals.isActive, 1)))
    .get();
  const careerProfile = db
    .select({ headline: careerProfiles.headline })
    .from(careerProfiles)
    .where(eq(careerProfiles.userId, userId))
    .get();
  const userProfile = [
    `이름: ${user?.name ?? "사용자"}.`,
    careerGoal ? `커리어 목표: ${careerGoal.name}.` : null,
    careerProfile?.headline ? `프로필: ${careerProfile.headline}.` : null,
    `등록된 활동 ${myActivities.length}개 (수상 ${wonCount}회).`,
    `이 활동에 대한 메모: ${activity.memo ?? "없음"}`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ctx: {
      activityName: activity.name,
      activityType: activity.type,
      organizer: activity.organizer,
      criteria,
      announcementText,
      submissionText,
      submissionTitle,
      userProfile,
      extraInstruction,
    },
    versionId,
  };
}

// ─── 실행 + JSON 검증/재시도 ─────────────────────────────────

function schemaFor(action: AIAction) {
  switch (action) {
    case "analyze_announcement":
    case "extract_criteria":
      return { kind: "announcement" as const, schema: announcementSummarySchema };
    case "analyze_opportunity":
      return { kind: "opportunity" as const, schema: opportunityRequirementsSchema };
    case "evaluate_submission":
      return { kind: "evaluation" as const, schema: evaluationResultSchema };
    case "final_check":
      return { kind: "final_check" as const, schema: finalCheckSchema };
    default:
      return { kind: "advice" as const, schema: adviceResultSchema };
  }
}

async function completeWithRetry(
  provider: Awaited<ReturnType<typeof getProvider>>,
  request: AIRequest,
): Promise<AIResultData> {
  const { kind, schema } = schemaFor(request.action);
  let lastError = "";
  let lastRaw = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0 ? request.prompt : buildRetryPrompt(request.prompt, lastRaw, lastError);
    const raw = await provider.complete({ ...request, prompt });
    lastRaw = raw;

    try {
      const json = extractJson(raw);
      const parsed = schema.safeParse(json);
      if (parsed.success) {
        return { kind, data: parsed.data } as AIResultData;
      }
      lastError = parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`AI 응답 JSON 검증에 실패했습니다: ${lastError}`);
}

// ─── 결과 저장 ───────────────────────────────────────────────

function persistResult(
  reviewId: string,
  userId: string,
  activityId: string,
  activityName: string,
  action: AIAction,
  result: AIResultData,
  submissionId: string | null,
): void {
  let overallScore: number | null = null;
  let maxScore: number | null = null;
  let confidence: number | null = null;
  let summary = "";

  if (result.kind === "evaluation") {
    overallScore = result.data.overall_score;
    maxScore = result.data.max_score;
    confidence = result.data.confidence;
    summary = result.data.summary;

    result.data.criteria.forEach((item, idx) => {
      db.insert(aiReviewItems)
        .values({
          id: newId(),
          reviewId,
          name: item.name,
          score: item.score,
          maxScore: item.max_score,
          strengths: JSON.stringify(item.strengths),
          weaknesses: JSON.stringify(item.weaknesses),
          recommendations: JSON.stringify(item.recommendations),
          position: idx,
        })
        .run();
    });
  } else if (result.kind === "final_check") {
    overallScore = result.data.score;
    maxScore = 100;
    summary = result.data.summary;
  } else if (result.kind === "advice") {
    overallScore = result.data.score ?? null;
    maxScore = result.data.score !== null && result.data.score !== undefined ? 100 : null;
    summary = result.data.summary;
  } else {
    summary = result.data.summary;
  }

  db.update(aiReviews)
    .set({
      status: "done",
      overallScore,
      maxScore,
      confidence,
      summary,
      resultJson: JSON.stringify(result.data),
      completedAt: Date.now(),
    })
    .where(eq(aiReviews.id, reviewId))
    .run();

  // 제출물 평가면 제출물 상태 갱신
  if (action === "evaluate_submission" && submissionId) {
    db.update(submissions)
      .set({ status: "ai_reviewed", updatedAt: Date.now() })
      .where(eq(submissions.id, submissionId))
      .run();
  }

  const scoreText =
    overallScore !== null && maxScore !== null
      ? ` — ${Math.round(overallScore * 10) / 10}/${maxScore}점`
      : "";
  logHistory(userId, activityId, "ai", `${AI_ACTIONS[action]} 완료${scoreText}`);
  pushNotification({
    userId,
    activityId,
    type: "ai",
    title: `${AI_ACTIONS[action]} 완료`,
    body: `${activityName}${scoreText}`,
  });
}

/** 리뷰 결과 JSON을 타입 안전하게 다시 읽기 */
export function parseReviewResult(action: string, resultJson: string | null): AIResultData | null {
  if (!resultJson) return null;
  const raw = safeJsonParse<unknown>(resultJson, null);
  if (!raw) return null;
  const { kind, schema } = schemaFor(action as AIAction);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return null;
  return { kind, data: parsed.data } as AIResultData;
}
