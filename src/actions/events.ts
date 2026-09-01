"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, events, activities } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logHistory } from "@/lib/history";
import { newId } from "@/lib/utils";
import { eventSchema, type EventInput } from "@/lib/validators";
import type { ActionResult } from "@/actions/activities";

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
    const act = db
      .select({ id: activities.id })
      .from(activities)
      .where(and(eq(activities.id, data.activityId), eq(activities.userId, user.id)))
      .get();
    if (!act) return { ok: false, error: "활동을 찾을 수 없습니다." };
  }

  const id = newId();
  db.insert(events)
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
    })
    .run();

  if (data.activityId) {
    logHistory(user.id, data.activityId, "event", `일정 추가: ${data.title} (${data.date})`);
  }
  revalidateEventPaths(data.activityId);
  return { ok: true, id };
}

export async function updateEvent(eventId: string, input: EventInput): Promise<ActionResult> {
  const user = await requireUser();
  const existing = db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.userId, user.id)))
    .get();
  if (!existing) return { ok: false, error: "일정을 찾을 수 없습니다." };

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  db.update(events)
    .set({
      title: data.title,
      type: data.type,
      date: data.date,
      time: data.time,
      endDate: data.endDate,
      memo: data.memo,
    })
    .where(eq(events.id, eventId))
    .run();

  revalidateEventPaths(existing.activityId);
  return { ok: true, id: eventId };
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.userId, user.id)))
    .get();
  if (!existing) return { ok: false, error: "일정을 찾을 수 없습니다." };

  db.delete(events).where(eq(events.id, eventId)).run();
  if (existing.activityId) {
    logHistory(user.id, existing.activityId, "event", `일정 삭제: ${existing.title}`);
  }
  revalidateEventPaths(existing.activityId);
  return { ok: true };
}
