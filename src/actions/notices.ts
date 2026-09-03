"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, noticeSources, noticeItems } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { validateNoticeUrl } from "@/services/document/html-text";
import { collectSource, collectForUser } from "@/services/notice/collect";
import { quickCreateActivity } from "@/actions/quick-create";
import { newId } from "@/lib/utils";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { id?: string; found?: number } : T))
  | { ok: false; error: string };

const sourceSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요.").max(60),
  url: z.string().trim().min(1, "주소를 입력해주세요.").max(500),
  keywords: z.string().max(200).optional(),
});

/** 관심 사이트 등록. 등록하자마자 한 번 확인해 목록을 채운다. */
export async function addNoticeSource(input: z.input<typeof sourceSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const checked = validateNoticeUrl(parsed.data.url);
  if ("error" in checked) return { ok: false, error: checked.error };

  const existing = await db
    .select({ id: noticeSources.id })
    .from(noticeSources)
    .where(and(eq(noticeSources.userId, user.id), eq(noticeSources.url, checked.url.toString())));
  if (existing.length > 0) return { ok: false, error: "이미 등록한 사이트입니다." };

  const id = newId();
  await db.insert(noticeSources).values({
    id,
    userId: user.id,
    name: parsed.data.name.trim(),
    url: checked.url.toString(),
    keywords: parsed.data.keywords?.trim() || null,
    active: 1,
    lastFound: 0,
    createdAt: Date.now(),
  });

  // 첫 확인은 알림 없이 목록만 채운다 (collectSource 안에서 처리)
  const source = (await db.select().from(noticeSources).where(eq(noticeSources.id, id)).limit(1))[0];
  const result = source ? await collectSource(source) : { ok: false, found: 0, error: "저장에 실패했습니다." };

  revalidatePath("/opportunities");
  return result.ok
    ? { ok: true, id, found: result.found }
    : { ok: false, error: result.error ?? "가져오지 못했습니다." };
}

export async function deleteNoticeSource(sourceId: string): Promise<ActionResult> {
  const user = await requireUser();
  const source = await ownedSource(user.id, sourceId);
  if (!source) return { ok: false, error: "찾을 수 없습니다." };

  await db.delete(noticeItems).where(eq(noticeItems.sourceId, sourceId));
  await db.delete(noticeSources).where(eq(noticeSources.id, sourceId));
  revalidatePath("/opportunities");
  return { ok: true };
}

export async function toggleNoticeSource(sourceId: string): Promise<ActionResult> {
  const user = await requireUser();
  const source = await ownedSource(user.id, sourceId);
  if (!source) return { ok: false, error: "찾을 수 없습니다." };

  await db
    .update(noticeSources)
    .set({ active: source.active === 1 ? 0 : 1 })
    .where(eq(noticeSources.id, sourceId));
  revalidatePath("/opportunities");
  return { ok: true };
}

/** 지금 바로 확인 (소스 하나 또는 전체) */
export async function checkNoticeSource(sourceId?: string): Promise<ActionResult> {
  const user = await requireUser();

  if (sourceId) {
    const source = await ownedSource(user.id, sourceId);
    if (!source) return { ok: false, error: "찾을 수 없습니다." };
    const result = await collectSource(source);
    revalidatePath("/opportunities");
    return result.ok ? { ok: true, found: result.found } : { ok: false, error: result.error ?? "가져오지 못했습니다." };
  }

  const { found } = await collectForUser(user.id);
  revalidatePath("/opportunities");
  return { ok: true, found };
}

/** 목록에서 숨기기 (관심 없는 공고) */
export async function dismissNoticeItem(itemId: string): Promise<ActionResult> {
  const user = await requireUser();
  const item = await ownedItem(user.id, itemId);
  if (!item) return { ok: false, error: "찾을 수 없습니다." };

  await db.update(noticeItems).set({ status: "dismissed" }).where(eq(noticeItems.id, itemId));
  revalidatePath("/opportunities");
  return { ok: true };
}

/**
 * 수집한 공고를 활동으로 등록한다.
 * 이미 있는 "링크로 한 번에 등록"을 그대로 쓰므로 공고문 분석까지 이어진다.
 */
export async function addNoticeAsActivity(itemId: string): Promise<ActionResult> {
  const user = await requireUser();
  const item = await ownedItem(user.id, itemId);
  if (!item) return { ok: false, error: "찾을 수 없습니다." };

  const created = await quickCreateActivity({ url: item.url });
  if (!created.ok) return { ok: false, error: created.error ?? "등록하지 못했습니다." };

  await db
    .update(noticeItems)
    .set({ status: "added", activityId: created.activityId ?? null })
    .where(eq(noticeItems.id, itemId));
  revalidatePath("/opportunities");
  revalidatePath("/activities");
  return { ok: true, id: created.activityId };
}

/** 화면에 뿌릴 목록 (새 공고 우선) */
export async function listNoticeItems(limit = 50) {
  const user = await requireUser();
  return db
    .select()
    .from(noticeItems)
    .where(and(eq(noticeItems.userId, user.id), eq(noticeItems.status, "new")))
    .orderBy(desc(noticeItems.foundAt))
    .limit(limit);
}

async function ownedSource(userId: string, sourceId: string) {
  return (
    await db
      .select()
      .from(noticeSources)
      .where(and(eq(noticeSources.id, sourceId), eq(noticeSources.userId, userId)))
      .limit(1)
  )[0];
}

async function ownedItem(userId: string, itemId: string) {
  return (
    await db
      .select()
      .from(noticeItems)
      .where(and(eq(noticeItems.id, itemId), eq(noticeItems.userId, userId)))
      .limit(1)
  )[0];
}
