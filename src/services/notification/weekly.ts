import "server-only";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, activities, tasks, events, userSettings, careerActions, notifications } from "@/lib/db";
import { pushNotification } from "@/lib/history";
import { getCareerContext, getScoreTrend } from "@/lib/career-queries";
import { toDateStr, todayStr } from "@/lib/utils";
import { ONGOING_STATUSES } from "@/lib/constants";
import { parseNotifySettings, weekKey } from "./settings";
import { buildWeeklyReport, type WeeklyReport } from "./weekly-format";

/**
 * 주간 리포트.
 * "앱을 열지 않아도 이번 주에 뭘 해야 하는지" 한 줄로 알려주는 것이 목적이다.
 */

/** 리포트를 만들어 앱 알림으로 남긴다. 이미 이번 주에 보냈으면 아무 일도 하지 않는다. */
export async function runWeeklyReport(
  userId: string,
  now = Date.now(),
): Promise<{ sent: boolean; push?: string }> {
  const settingsRows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  const settings = parseNotifySettings(settingsRows[0]);
  if (!settings.weeklyReport) return { sent: false };

  // 같은 주에 두 번 보내지 않는다 (크론이 하루에 여러 번 돌아도 안전).
  // 이미 보냈는지 먼저 확인해야 푸시도 중복으로 나가지 않는다.
  const dedupeKey = `weekly:${weekKey(now, settings.timezoneOffset)}`;
  const already = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.dedupeKey, dedupeKey)))
    .limit(1);
  if (already.length > 0) return { sent: false };

  const report = await composeReport(userId);
  await pushNotification({
    userId,
    type: "system",
    title: report.title,
    body: report.body,
    dedupeKey,
  });
  return { sent: true, push: report.push };
}

async function composeReport(userId: string): Promise<WeeklyReport> {
  const today = todayStr();
  const weekEnd = toDateStr(new Date(Date.now() + 7 * 86400000));
  const weekAgoMs = Date.now() - 7 * 86400000;

  const [acts, weekEvents, doneTaskRows, ctx, trend, actions] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, userId), inArray(activities.status, [...ONGOING_STATUSES, "interested"]))),
    db
      .select()
      .from(events)
      .where(and(eq(events.userId, userId), gte(events.date, today), lte(events.date, weekEnd))),
    db
      .select({ id: tasks.id, completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, "done"))),
    getCareerContext(userId),
    getScoreTrend(userId),
    db
      .select()
      .from(careerActions)
      .where(and(eq(careerActions.userId, userId), eq(careerActions.status, "accepted")))
      .orderBy(desc(careerActions.updatedAt))
      .limit(1),
  ]);

  const upcoming: Array<{ name: string; what: string; date: string }> = [];
  for (const act of acts) {
    for (const [date, what] of [
      [act.applyDeadline, "지원 마감"],
      [act.submitDeadline, "제출 마감"],
      [act.announceDate, "결과 발표"],
    ] as Array<[string | null, string]>) {
      if (date && date >= today && date <= weekEnd) upcoming.push({ name: act.name, what, date });
    }
  }
  for (const evt of weekEvents) {
    if (!evt.activityId) upcoming.push({ name: evt.title, what: "일정", date: evt.date });
  }
  upcoming.sort((a, b) => (a.date < b.date ? -1 : 1));

  const doneTasks = doneTaskRows.filter((t) => t.completedAt && t.completedAt >= weekAgoMs).length;
  const newActivities = acts.filter((a) => a.createdAt >= weekAgoMs).length;

  return buildWeeklyReport({
    upcoming,
    doneTasks,
    newActivities,
    scoreLatest: ctx.onboarded ? Math.round(trend.latest ?? ctx.readiness.score) : null,
    // 주간 변화를 따로 저장하지 않으므로 30일 전 값을 비교 대상으로 쓴다
    scoreWeekAgo: trend.monthAgo != null ? Math.round(trend.monthAgo) : null,
    nextAction: actions[0]?.title ?? ctx.mission?.title ?? null,
  });
}
