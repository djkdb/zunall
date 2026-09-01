"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, notes, activities } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { newId } from "@/lib/utils";
import type { ActionResult } from "@/actions/activities";

/** 활동별 개인 메모 저장 (upsert) */
export async function saveNote(activityId: string, content: string): Promise<ActionResult> {
  const user = await requireUser();
  const act = await db
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, user.id)))
    .get();
  if (!act) return { ok: false, error: "활동을 찾을 수 없습니다." };
  if (content.length > 20000) return { ok: false, error: "메모가 너무 깁니다." };

  const existing = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.activityId, activityId), eq(notes.userId, user.id)))
    .get();

  if (existing) {
    await db.update(notes)
      .set({ content, updatedAt: Date.now() })
      .where(eq(notes.id, existing.id))
      .run();
  } else {
    await db.insert(notes)
      .values({ id: newId(), userId: user.id, activityId, content, updatedAt: Date.now() })
      .run();
  }

  revalidatePath(`/activities/${activityId}`);
  return { ok: true };
}
