"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, documents, activities } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logHistory, pushNotification } from "@/lib/history";
import { saveFile, validateUpload, deleteStoredFile } from "@/lib/storage";
import { extractText, isExtractable } from "@/services/document/extract";
import { newId } from "@/lib/utils";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/constants";
import type { ActionResult } from "@/actions/activities";

const MAX_EXTRACT_CHARS = 200_000;

async function assertOwnedActivity(activityId: string, userId: string) {
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .get();
}

/**
 * 파일 업로드. groupId를 주면 해당 문서의 새 버전으로 저장된다.
 * 업로드와 동시에 텍스트 추출을 시도해 캐시한다 (AI 분석에 사용).
 */
export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const activityId = String(formData.get("activityId") ?? "");
  const category = String(formData.get("category") ?? "reference");
  const description = String(formData.get("description") ?? "").trim() || null;
  const groupId = String(formData.get("groupId") ?? "") || null;
  const file = formData.get("file");

  const activity = await assertOwnedActivity(activityId, user.id);
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };
  if (!(category in DOC_CATEGORIES)) return { ok: false, error: "잘못된 분류입니다." };
  if (!(file instanceof File)) return { ok: false, error: "파일을 선택해주세요." };

  const validationError = validateUpload(file);
  if (validationError) return { ok: false, error: validationError };

  // 새 버전 업로드인 경우 기존 그룹 확인
  let version = 1;
  let displayName = file.name;
  if (groupId) {
    const latest = db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.groupId, groupId),
          eq(documents.userId, user.id),
          eq(documents.activityId, activityId),
        ),
      )
      .orderBy(desc(documents.version))
      .get();
    if (!latest) return { ok: false, error: "버전을 올릴 문서를 찾을 수 없습니다." };
    version = latest.version + 1;
    displayName = latest.name;
  }

  let stored: { storagePath: string; size: number };
  try {
    stored = await saveFile(user.id, file);
  } catch {
    return { ok: false, error: "파일 저장에 실패했습니다. 다시 시도해주세요." };
  }

  // 텍스트 추출 (실패해도 업로드는 성공 처리)
  let extractedText: string | null = null;
  if (isExtractable(file.name)) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractText(buffer, file.name);
    if (result.ok && result.text) {
      extractedText = result.text.slice(0, MAX_EXTRACT_CHARS);
    }
  }

  const id = newId();
  db.insert(documents)
    .values({
      id,
      userId: user.id,
      activityId,
      category,
      name: displayName,
      originalName: file.name,
      mime: file.type || "application/octet-stream",
      size: stored.size,
      storagePath: stored.storagePath,
      description,
      version,
      groupId: groupId ?? id,
      extractedText,
      createdAt: Date.now(),
    })
    .run();

  logHistory(
    user.id,
    activityId,
    "file",
    groupId
      ? `파일 새 버전 업로드: ${displayName} (v${version})`
      : `파일 업로드: ${displayName} [${DOC_CATEGORIES[category as DocCategory]}]`,
  );
  pushNotification({
    userId: user.id,
    activityId,
    type: "file",
    title: `파일 업로드 완료`,
    body: `${activity.name} — ${displayName}${version > 1 ? ` (v${version})` : ""}`,
  });

  revalidatePath(`/activities/${activityId}`);
  return { ok: true, id };
}

export async function updateDocumentMeta(
  documentId: string,
  meta: { category?: string; description?: string; name?: string },
): Promise<ActionResult> {
  const user = await requireUser();
  const doc = db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
    .get();
  if (!doc) return { ok: false, error: "문서를 찾을 수 없습니다." };

  const updates: Partial<typeof documents.$inferInsert> = {};
  if (meta.category && meta.category in DOC_CATEGORIES) updates.category = meta.category;
  if (meta.description !== undefined) updates.description = meta.description.trim() || null;
  if (meta.name !== undefined && meta.name.trim()) updates.name = meta.name.trim().slice(0, 200);
  if (Object.keys(updates).length === 0) return { ok: true };

  db.update(documents).set(updates).where(eq(documents.id, documentId)).run();
  revalidatePath(`/activities/${doc.activityId}`);
  return { ok: true };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const user = await requireUser();
  const doc = db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
    .get();
  if (!doc) return { ok: false, error: "문서를 찾을 수 없습니다." };

  deleteStoredFile(doc.storagePath);
  db.delete(documents).where(eq(documents.id, documentId)).run();
  logHistory(user.id, doc.activityId, "file", `파일 삭제: ${doc.name} (v${doc.version})`);

  revalidatePath(`/activities/${doc.activityId}`);
  return { ok: true };
}
