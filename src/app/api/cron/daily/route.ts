import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, activities, pushSubscriptions, users } from "@/lib/db";
import { sendPush, pushConfigured } from "@/services/push/webpush";
import { ensureDeadlineNotifications } from "@/services/notification/generator";
import { daysUntil, ddayLabel } from "@/lib/utils";
import { NOTIFY_THRESHOLDS, ONGOING_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * 하루 한 번 도는 알림 작업 (Cloudflare Cron 또는 외부 스케줄러가 호출).
 * - 앱 내부 알림을 생성하고
 * - 브라우저 푸시를 구독한 기기에 오늘의 마감 요약을 보낸다
 *
 * CRON_KEY 로 보호한다. 키가 없으면 아무 일도 하지 않는다(실수로 공개되는 것 방지).
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_KEY;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "CRON_KEY 가 설정되지 않았습니다." }, { status: 503 });
  }
  const url = new URL(request.url);
  const provided = url.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (provided !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 푸시를 구독한 사용자만 대상으로 한다
  const subs = await db.select().from(pushSubscriptions);
  const byUser = new Map<string, typeof subs>();
  for (const sub of subs) {
    const list = byUser.get(sub.userId) ?? [];
    list.push(sub);
    byUser.set(sub.userId, list);
  }

  let notified = 0;
  let pushed = 0;
  let removed = 0;

  for (const [userId, devices] of byUser) {
    const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!user) continue;

    await ensureDeadlineNotifications(userId);
    notified++;

    if (!pushConfigured()) continue;

    const acts = await db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          inArray(activities.status, [...ONGOING_STATUSES, "interested"]),
        ),
      );

    const items: Array<{ days: number; text: string }> = [];
    for (const act of acts) {
      const checks: Array<[string | null, string]> = [
        [act.applyDeadline, "지원 마감"],
        [act.submitDeadline, "제출 마감"],
        [act.announceDate, "결과 발표"],
      ];
      for (const [date, label] of checks) {
        const days = daysUntil(date);
        if (days === null || days < 0) continue;
        if (!(NOTIFY_THRESHOLDS as readonly number[]).includes(days)) continue;
        items.push({ days, text: `${ddayLabel(days)} ${act.name} ${label}` });
      }
    }
    if (items.length === 0) continue;

    items.sort((a, b) => a.days - b.days);
    const head = items[0];
    const payload = {
      title: items.length === 1 ? head.text : `오늘 챙길 일 ${items.length}건`,
      body: items.slice(0, 3).map((i) => i.text).join("\n") + (items.length > 3 ? `\n외 ${items.length - 3}건` : ""),
      url: "/",
      tag: "cavero-daily",
    };

    for (const device of devices) {
      const result = await sendPush(device, payload);
      if (result.ok) {
        pushed++;
        await db
          .update(pushSubscriptions)
          .set({ lastSuccessAt: Date.now(), failureCount: 0 })
          .where(eq(pushSubscriptions.id, device.id));
      } else if (result.gone) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, device.id));
        removed++;
      } else {
        await db
          .update(pushSubscriptions)
          .set({ failureCount: device.failureCount + 1 })
          .where(eq(pushSubscriptions.id, device.id));
      }
    }
  }

  return NextResponse.json({ ok: true, users: byUser.size, notified, pushed, removed });
}
