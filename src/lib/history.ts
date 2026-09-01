import "server-only";
import { and, eq } from "drizzle-orm";
import { db, activityHistory, notifications } from "@/lib/db";
import { newId } from "@/lib/utils";
import type { HistoryKind, NotificationType } from "@/lib/constants";

/** 활동 진행 기록 추가 */
export function logHistory(
  userId: string,
  activityId: string,
  kind: HistoryKind,
  message: string,
): void {
  db.insert(activityHistory)
    .values({ id: newId(), userId, activityId, kind, message, createdAt: Date.now() })
    .run();
}

/** 앱 내부 알림 생성 (dedupeKey가 있으면 중복 생성하지 않음) */
export function pushNotification(params: {
  userId: string;
  activityId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  dedupeKey?: string;
}): void {
  if (params.dedupeKey) {
    const existing = db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, params.userId), eq(notifications.dedupeKey, params.dedupeKey)))
      .get();
    if (existing) return;
  }
  db.insert(notifications)
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
    })
    .run();
}
