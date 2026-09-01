"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, submissions, submissionVersions, documents, activities } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logHistory, pushNotification } from "@/lib/history";
import { saveFile, validateUpload, deleteStoredFile } from "@/lib/storage";
import { extractText, isExtractable } from "@/services/document/extract";
import { newId } from "@/lib/utils";
import { submissionSchema, type SubmissionInput } from "@/lib/validators";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/constants";
import type { ActionResult } from "@/actions/activities";

async function getOwnedSubmission(submissionId: string, userId: string) {
  return (await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, submissionId), eq(submissions.userId, userId)))
    .limit(1))[0];
}

export async function createSubmission(
  activityId: string,
  input: SubmissionInput,
): Promise<ActionResult> {
  const user = await requireUser();
  const activity = (await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, user.id)))
    .limit(1))[0];
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const id = newId();
  const now = Date.now();
  await db.insert(submissions)
    .values({
      id,
      userId: user.id,
      activityId,
      title: data.title,
      description: data.description,
      status: data.status,
      dueDate: data.dueDate,
      createdAt: now,
      updatedAt: now,
    });

  await logHistory(user.id, activityId, "submission", `제출물 추가: ${data.title}`);
  revalidatePath(`/activities/${activityId}`);
  return { ok: true, id };
}

export async function updateSubmission(
  submissionId: string,
  input: SubmissionInput,
): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await getOwnedSubmission(submissionId, user.id);
  if (!existing) return { ok: false, error: "제출물을 찾을 수 없습니다." };

  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  await db.update(submissions)
    .set({
      title: data.title,
      description: data.description,
      status: data.status,
      dueDate: data.dueDate,
      updatedAt: Date.now(),
    })
    .where(eq(submissions.id, submissionId));

  if (existing.status !== data.status) {
    await logHistory(
      user.id,
      existing.activityId,
      "submission",
      `제출물 "${existing.title}" 상태 변경: ${SUBMISSION_STATUSES[existing.status as SubmissionStatus] ?? existing.status} → ${SUBMISSION_STATUSES[data.status as SubmissionStatus] ?? data.status}`,
    );
  }
  revalidatePath(`/activities/${existing.activityId}`);
  return { ok: true, id: submissionId };
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await getOwnedSubmission(submissionId, user.id);
  if (!existing) return { ok: false, error: "제출물을 찾을 수 없습니다." };
  if (!(status in SUBMISSION_STATUSES)) return { ok: false, error: "잘못된 상태입니다." };

  await db.update(submissions)
    .set({ status, updatedAt: Date.now() })
    .where(eq(submissions.id, submissionId));

  await logHistory(
    user.id,
    existing.activityId,
    "submission",
    `제출물 "${existing.title}" 상태 변경: ${SUBMISSION_STATUSES[status as SubmissionStatus]}`,
  );
  revalidatePath(`/activities/${existing.activityId}`);
  return { ok: true };
}

export async function deleteSubmission(submissionId: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await getOwnedSubmission(submissionId, user.id);
  if (!existing) return { ok: false, error: "제출물을 찾을 수 없습니다." };

  // 연결된 버전 및 파일 정리
  const versions = await db
    .select()
    .from(submissionVersions)
    .where(eq(submissionVersions.submissionId, submissionId));
  for (const v of versions) {
    const doc = (await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, v.documentId), eq(documents.userId, user.id)))
      .limit(1))[0];
    if (doc) {
      await deleteStoredFile(doc.storagePath);
      await db.delete(documents).where(eq(documents.id, doc.id));
    }
  }
  await db.delete(submissionVersions).where(eq(submissionVersions.submissionId, submissionId));
  await db.delete(submissions).where(eq(submissions.id, submissionId));

  await logHistory(user.id, existing.activityId, "submission", `제출물 삭제: ${existing.title}`);
  revalidatePath(`/activities/${existing.activityId}`);
  return { ok: true };
}

/**
 * 제출물 버전 파일 업로드. 자동으로 v1, v2, … 라벨이 붙고
 * isFinal 지정 시 "Final"로 표시된다.
 */
export async function uploadSubmissionVersion(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const submissionId = String(formData.get("submissionId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const isFinal = formData.get("isFinal") === "true";
  const file = formData.get("file");

  const submission = await getOwnedSubmission(submissionId, user.id);
  if (!submission) return { ok: false, error: "제출물을 찾을 수 없습니다." };
  if (!(file instanceof File)) return { ok: false, error: "파일을 선택해주세요." };

  const validationError = validateUpload(file);
  if (validationError) return { ok: false, error: validationError };

  let stored: { storagePath: string; size: number };
  try {
    stored = await saveFile(user.id, file);
  } catch {
    return { ok: false, error: "파일 저장에 실패했습니다. 다시 시도해주세요." };
  }

  let extractedText: string | null = null;
  if (isExtractable(file.name)) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractText(buffer, file.name);
    if (result.ok && result.text) extractedText = result.text.slice(0, 200_000);
  }

  const versionCount = (
    await db
      .select({ id: submissionVersions.id })
      .from(submissionVersions)
      .where(eq(submissionVersions.submissionId, submissionId))

  ).length;
  const versionLabel = isFinal ? "Final" : `v${versionCount + 1}`;

  const docId = newId();
  await db.insert(documents)
    .values({
      id: docId,
      userId: user.id,
      activityId: submission.activityId,
      category: "submission",
      name: `${submission.title} (${versionLabel})`,
      originalName: file.name,
      mime: file.type || "application/octet-stream",
      size: stored.size,
      storagePath: stored.storagePath,
      description: note,
      version: versionCount + 1,
      groupId: docId,
      extractedText,
      createdAt: Date.now(),
    });

  if (isFinal) {
    // 기존 Final 표시 해제
    await db.update(submissionVersions)
      .set({ isFinal: 0 })
      .where(eq(submissionVersions.submissionId, submissionId));
  }

  const versionId = newId();
  await db.insert(submissionVersions)
    .values({
      id: versionId,
      submissionId,
      documentId: docId,
      versionLabel,
      isFinal: isFinal ? 1 : 0,
      note,
      createdAt: Date.now(),
    });

  if (isFinal) {
    await db.update(submissions)
      .set({ status: "final", updatedAt: Date.now() })
      .where(eq(submissions.id, submissionId));
  } else if (submission.status === "submitted" || submission.status === "final") {
    // 새 버전이 올라오면 다시 작성 중 상태로
    await db.update(submissions)
      .set({ status: "draft", updatedAt: Date.now() })
      .where(eq(submissions.id, submissionId));
  }

  await logHistory(
    user.id,
    submission.activityId,
    "submission",
    `제출물 "${submission.title}" ${versionLabel} 업로드 (${file.name})`,
  );
  await pushNotification({
    userId: user.id,
    activityId: submission.activityId,
    type: "file",
    title: `제출물 버전 업로드`,
    body: `${submission.title} — ${versionLabel}`,
  });

  revalidatePath(`/activities/${submission.activityId}`);
  return { ok: true, id: versionId };
}
