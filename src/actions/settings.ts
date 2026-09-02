"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, userSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { DASHBOARD_WIDGETS, DEFAULT_WIDGETS, type WidgetKey } from "@/lib/dashboard-widgets";

/** 대시보드에 표시할 위젯과 순서를 저장한다 */
export async function saveDashboardWidgets(keys: string[]): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const valid = keys.filter((key): key is WidgetKey => key in DASHBOARD_WIDGETS);
  const value = JSON.stringify(valid.length > 0 ? valid : DEFAULT_WIDGETS);
  const now = Date.now();

  const existing = (
    await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1)
  )[0];

  if (existing) {
    await db
      .update(userSettings)
      .set({ dashboardWidgets: value, updatedAt: now })
      .where(eq(userSettings.userId, user.id));
  } else {
    await db.insert(userSettings).values({
      userId: user.id,
      dashboardWidgets: value,
      updatedAt: now,
    });
  }

  revalidatePath("/");
  return { ok: true };
}
