"use server";

import { and, eq } from "drizzle-orm";
import { db, pushSubscriptions } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { sendPush, pushConfigured, vapidPublicKey } from "@/services/push/webpush";
import { newId } from "@/lib/utils";

export interface PushEnv {
  configured: boolean;
  publicKey: string | null;
}

export async function getPushEnv(): Promise<PushEnv> {
  return { configured: pushConfigured(), publicKey: vapidPublicKey() };
}

/** 브라우저가 만든 구독 정보를 저장한다 (같은 기기면 갱신) */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { ok: false, error: "구독 정보가 올바르지 않습니다." };
  }

  const existing = (
    await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, input.endpoint))
      .limit(1)
  )[0];

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({ userId: user.id, p256dh: input.p256dh, auth: input.auth, failureCount: 0 })
      .where(eq(pushSubscriptions.endpoint, input.endpoint));
    return { ok: true };
  }

  await db.insert(pushSubscriptions).values({
    id: newId(),
    userId: user.id,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent?.slice(0, 200) ?? null,
    createdAt: Date.now(),
    failureCount: 0,
  });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint)));
  return { ok: true };
}

/** 설정 화면의 '테스트 알림 보내기' */
export async function sendTestPush(): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!pushConfigured()) {
    return { ok: false, error: "서버에 VAPID 키가 설정되지 않았습니다." };
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id));
  if (subs.length === 0) return { ok: false, error: "이 계정에 등록된 기기가 없습니다." };

  let sent = 0;
  for (const sub of subs) {
    const result = await sendPush(sub, {
      title: "Cavero 알림 테스트",
      body: "이렇게 마감 알림이 도착합니다.",
      url: "/notifications",
      tag: "test",
    });
    if (result.ok) sent++;
    if (result.gone) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    }
  }
  return sent > 0 ? { ok: true } : { ok: false, error: "전송에 실패했습니다. 알림 권한을 확인해주세요." };
}

/** 이 계정에 등록된 기기 수 */
export async function countPushDevices(): Promise<number> {
  const user = await requireUser();
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id));
  return rows.length;
}
