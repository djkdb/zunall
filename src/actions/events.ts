"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, events, activities } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logHistory } from "@/lib/history";
import { newId } from "@/lib/utils";
import { eventSchema, type EventInput } from "@/lib/validators";
import type { ActionResult } from "@/actions/activities";
import { runDeadlineNotifications } from "@/services/notification/generator";

function revalidateEventPaths(activityId: string | null) {
  revalidatePath("/calendar");
  revalidatePath("/");
  if (activityId) revalidatePath(`/activities/${activityId}`);
}

export async function createEvent(input: EventInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  // activityId가 주어졌으면 소유권 확인
  if (data.activityId) {
    const act = (await db
      .select({ id: activities.id })
      .from(activities)
      .where(and(eq(activities.id, data.activityId), eq(activities.userId, user.id)))
      .limit(1))[0];
    if (!act) return { ok: false, error: "활동을 찾을 수 없습니다." };
  }

  const id = newId();
  await db.insert(events)
    .values({
      id,
      userId: user.id,
      activityId: data.activityId,
      title: data.title,
      type: data.type,
      date: data.date,
      time: data.time,
      endDate: data.endDate,
      memo: data.memo,
      createdAt: Date.now(),
    });

  if (data.activityId) {
    await logHistory(user.id, data.activityId, "event", `일정 추가: ${data.title} (${data.date})`);
  }
  // 마감이 바뀌었으니 알림을 지금 다시 계산한다 (화면 이동 때마다 돌리지 않기 위해).
  await runDeadlineNotifications(user.id);
  revalidateEventPaths(data.activityId);
  return { ok: true, id };
}

export async function updateEvent(eventId: string, input: EventInput): Promise<ActionResult> {
  const user = await requireUser();
  const existing = (await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.userId, user.id)))
    .limit(1))[0];
  if (!existing) return { ok: false, error: "일정을 찾을 수 없습니다." };

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  await db.update(events)
    .set({
      title: data.title,
      type: data.type,
      date: data.date,
      time: data.time,
      endDate: data.endDate,
      memo: data.memo,
    })
    .where(eq(events.id, eventId));

  // 마감이 바뀌었으니 알림을 지금 다시 계산한다 (화면 이동 때마다 돌리지 않기 위해).
  await runDeadlineNotifications(user.id);
  revalidateEventPaths(existing.activityId);
  return { ok: true, id: eventId };
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = (await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.userId, user.id)))
    .limit(1))[0];
  if (!existing) return { ok: false, error: "일정을 찾을 수 없습니다." };

  await db.delete(events).where(eq(events.id, eventId));
  if (existing.activityId) {
    await logHistory(user.id, existing.activityId, "event", `일정 삭제: ${existing.title}`);
  }
  revalidateEventPaths(existing.activityId);
  return { ok: true };
}
