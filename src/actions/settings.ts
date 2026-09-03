"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, userSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { DASHBOARD_WIDGETS, DEFAULT_WIDGETS, type WidgetKey } from "@/lib/dashboard-widgets";
import { NOTIFICATION_TYPES } from "@/lib/constants";
import { THRESHOLD_CHOICES } from "@/services/notification/settings";

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

/** 알림 설정 (알릴 시점·종류·조용한 시간·주간 리포트)을 저장한다 */
export async function saveNotifySettings(input: {
  thresholds: number[];
  types: string[];
  quietStart: number | null;
  quietEnd: number | null;
  weeklyReport: boolean;
  weeklyDay: number;
  timezoneOffset: number;
}): Promise<{ ok: boolean }> {
  const user = await requireUser();

  // 아는 값만 저장한다 (화면에서 온 값이라도 그대로 믿지 않는다)
  const thresholds = input.thresholds
    .filter((n) => (THRESHOLD_CHOICES as readonly number[]).includes(n))
    .sort((a, b) => b - a);
  const types = input.types.filter((t) => t in NOTIFICATION_TYPES);
  const hour = (value: number | null) =>
    typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23 ? value : null;

  const values = {
    notifyThresholds: JSON.stringify(thresholds),
    notifyTypes: JSON.stringify(types),
    quietStart: hour(input.quietStart),
    quietEnd: hour(input.quietEnd),
    weeklyReport: input.weeklyReport ? 1 : 0,
    weeklyDay: input.weeklyDay >= 0 && input.weeklyDay <= 6 ? input.weeklyDay : 0,
    timezoneOffset: Math.abs(input.timezoneOffset) <= 14 * 60 ? input.timezoneOffset : 540,
    updatedAt: Date.now(),
  };

  const existing = (
    await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1)
  )[0];

  if (existing) {
    await db.update(userSettings).set(values).where(eq(userSettings.userId, user.id));
  } else {
    await db.insert(userSettings).values({ userId: user.id, ...values });
  }

  revalidatePath("/settings");
  return { ok: true };
}
