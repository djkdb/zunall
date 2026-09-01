import "server-only";
import { and, eq } from "drizzle-orm";
import { db, activityHistory, notifications } from "@/lib/db";
import { newId } from "@/lib/utils";
import type { HistoryKind, NotificationType } from "@/lib/constants";

/** 활동 진행 기록 추가 */
export async function logHistory(
  userId: string,
  activityId: string,
  kind: HistoryKind,
  message: string,
): Promise<void> {
  await db.insert(activityHistory)
    .values({ id: newId(), userId, activityId, kind, message, createdAt: Date.now() });
}

/** 앱 내부 알림 생성 (dedupeKey가 있으면 중복 생성하지 않음) */
export async function pushNotification(params: {
  userId: string;
  activityId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  dedupeKey?: string;
}): Promise<void> {
  if (params.dedupeKey) {
    const existing = (await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, params.userId), eq(notifications.dedupeKey, params.dedupeKey)))
      .limit(1))[0];
    if (existing) return;
  }
  await db.insert(notifications)
    .values({
      id: newId(),
      userId: params.userId,
      activityId: params.activityId ?? null,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      dedupeKey: params.dedupeKey ?? null,
      read: 0,
      createdAt: Date.now(),
    });
}
