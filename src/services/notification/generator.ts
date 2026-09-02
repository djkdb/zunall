import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, activities, events } from "@/lib/db";
import { pushNotification } from "@/lib/history";
import { daysUntil, ddayLabel } from "@/lib/utils";
import {
  DEADLINE_EVENT_TYPES,
  NOTIFY_THRESHOLDS,
  ONGOING_STATUSES,
  EVENT_TYPES,
  type EventType,
} from "@/lib/constants";

/**
 * 접속 시점에 마감 임박 알림을 생성한다.
 * - 진행 중인 활동의 지원 마감 / 제출 마감
 * - 마감 성격의 일정 (모집 마감, 지원 마감, 중간/최종 제출)
 * dedupeKey로 같은 알림이 두 번 생기지 않도록 보장한다.
 */
export async function ensureDeadlineNotifications(userId: string): Promise<void> {
  const acts = await db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, userId), inArray(activities.status, [...ONGOING_STATUSES, "interested"])));

  // 활동 마감일에서 이미 알린 (활동, 날짜)는 기억해둔다.
  // 활동을 만들면 같은 마감일로 일정도 함께 생기므로, 그대로 두면 알림이 두 번 뜬다.
  const notified = new Set<string>();
  const mark = (activityId: string | null, date: string | null | undefined) => {
    if (activityId && date) notified.add(`${activityId}:${date}`);
  };

  for (const act of acts) {
    await checkDeadline(userId, act.id, act.name, "지원 마감", act.applyDeadline, `act:${act.id}:apply`);
    await checkDeadline(userId, act.id, act.name, "결과물 제출", act.submitDeadline, `act:${act.id}:submit`);
    await checkDeadline(userId, act.id, act.name, "결과 발표", act.announceDate, `act:${act.id}:announce`);
    mark(act.id, act.applyDeadline);
    mark(act.id, act.submitDeadline);
    mark(act.id, act.announceDate);
  }

  const activityNames = new Map(acts.map((a) => [a.id, a.name]));
  const evts = await db
    .select()
    .from(events)
    .where(and(eq(events.userId, userId), inArray(events.type, DEADLINE_EVENT_TYPES)));

  for (const evt of evts) {
    // 활동 마감일로 이미 알린 날짜면 건너뛴다
    if (evt.activityId && notified.has(`${evt.activityId}:${evt.date}`)) continue;

    const actName = evt.activityId ? activityNames.get(evt.activityId) : undefined;
    // 일정 제목이 이미 활동명을 포함하면 겹쳐 쓰지 않는다
    const subject =
      actName && !evt.title.includes(actName) ? `${actName} · ${evt.title}` : evt.title;
    const label = `${EVENT_TYPES[evt.type as EventType] ?? evt.title}`;
    await checkDeadline(userId, evt.activityId, subject, label, evt.date, `event:${evt.id}`);
  }
}

async function checkDeadline(
  userId: string,
  activityId: string | null,
  subject: string,
  what: string,
  dateStr: string | null | undefined,
  keyPrefix: string,
): Promise<void> {
  const days = daysUntil(dateStr);
  if (days === null || days < 0) return;
  if (!(NOTIFY_THRESHOLDS as readonly number[]).includes(days)) return;

  const body =
    days === 0
      ? `${subject} — ${what}이(가) 오늘 마감됩니다.`
      : `${subject} — ${what}까지 ${days}일 남았습니다.`;

  await pushNotification({
    userId,
    activityId,
    type: "schedule",
    title: `${ddayLabel(days)} · ${subject}`,
    body,
    dedupeKey: `${keyPrefix}:d${days}`,
  });
}
