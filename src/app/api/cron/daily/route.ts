import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, activities, pushSubscriptions, users, noticeSources, userSettings } from "@/lib/db";
import { sendPush, pushConfigured } from "@/services/push/webpush";
import { runDeadlineNotifications } from "@/services/notification/generator";
import { collectForUser } from "@/services/notice/collect";
import { runWeeklyReport } from "@/services/notification/weekly";
import { isQuietHour, isWeeklyReportDay, parseNotifySettings } from "@/services/notification/settings";
import { daysUntil, ddayLabel } from "@/lib/utils";
import { NOTIFY_THRESHOLDS, ONGOING_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * 하루 한 번 도는 알림 작업 (Cloudflare Cron 또는 외부 스케줄러가 호출).
 * - 앱 내부 알림을 생성하고
 * - 등록한 공고 사이트에서 새 글을 찾아오고
 * - 설정한 요일이면 주간 리포트를 만들고
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

  // ── 공고 수집: 사이트를 등록한 사용자만 대상으로 한다 ──────────
  // (푸시 구독 여부와 무관하게, 등록해둔 사람은 모두 받아야 한다)
  const sourceOwners = new Set(
    (await db.select({ userId: noticeSources.userId }).from(noticeSources)).map((r) => r.userId),
  );
  let collected = 0;
  for (const userId of sourceOwners) {
    const result = await collectForUser(userId);
    collected += result.found;
  }

  // 푸시를 구독한 사용자만 대상으로 한다
  const subs = await db.select().from(pushSubscriptions);
  const byUser = new Map<string, typeof subs>();
  for (const sub of subs) {
    const list = byUser.get(sub.userId) ?? [];
    list.push(sub);
    byUser.set(sub.userId, list);
  }

  // 주간 리포트: 요일은 사용자가 정한다 (설정을 저장한 사용자만 대상)
  const settingsRows = await db.select().from(userSettings);
  const now = Date.now();
  let weekly = 0;
  const weeklyPush = new Map<string, string>();
  for (const row of settingsRows) {
    const settings = parseNotifySettings(row);
    if (!isWeeklyReportDay(now, settings)) continue;
    const result = await runWeeklyReport(row.userId, now);
    if (result.sent) {
      weekly++;
      if (result.push) weeklyPush.set(row.userId, result.push);
    }
  }

  const settingsByUser = new Map(settingsRows.map((row) => [row.userId, parseNotifySettings(row)]));

  let notified = 0;
  let pushed = 0;
  let removed = 0;
  let quiet = 0;

  for (const [userId, devices] of byUser) {
    const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!user) continue;

    await runDeadlineNotifications(userId);
    notified++;

    if (!pushConfigured()) continue;

    // 사용자가 정한 조용한 시간에는 푸시를 보내지 않는다 (앱 알림은 이미 남아 있다)
    const settings = settingsByUser.get(userId);
    if (settings && isQuietHour(now, settings)) {
      quiet++;
      continue;
    }
    if (settings && !settings.types.includes("schedule")) continue;

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
    // 주간 리포트가 있는 날이면 그것도 함께 알린다
    const report = weeklyPush.get(userId);
    if (items.length === 0 && !report) continue;

    items.sort((a, b) => a.days - b.days);
    const head = items[0];
    const payload = report
      ? { title: "주간 리포트", body: report, url: "/", tag: "cavero-weekly" }
      : {
          title: items.length === 1 ? head.text : `오늘 챙길 일 ${items.length}건`,
          body:
            items.slice(0, 3).map((i) => i.text).join("\n") +
            (items.length > 3 ? `\n외 ${items.length - 3}건` : ""),
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

  return NextResponse.json({
    ok: true,
    users: byUser.size,
    notified,
    pushed,
    removed,
    noticeUsers: sourceOwners.size,
    noticesFound: collected,
    weekly,
    quiet,
  });
}
