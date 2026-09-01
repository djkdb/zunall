"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, notifications } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import type { ActionResult } from "@/actions/activities";

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.update(notifications)
    .set({ read: 1 })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)))
    .run();
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await requireUser();
  await db.update(notifications)
    .set({ read: 1 })
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, 0)))
    .run();
  revalidatePath("/notifications");
  return { ok: true };
}

export async function deleteNotification(notificationId: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)))
    .run();
  revalidatePath("/notifications");
  return { ok: true };
}
