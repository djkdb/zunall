import { eq } from "drizzle-orm";
import { db, users, activities, events } from "@/lib/db";
import { buildIcs, type IcsEntry } from "@/services/calendar/ics";
import { ACTIVITY_STATUSES, EVENT_TYPES, type ActivityStatus, type EventType } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * 캘린더 구독(.ics).
 * 구글/애플 캘린더는 쿠키를 보내지 않으므로, 사용자마다 발급한 비밀 토큰으로 인증한다.
 * 토큰은 설정 화면에서 언제든 새로 발급(= 기존 구독 무효화)할 수 있다.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/i, "");
  if (!clean || clean.length < 20) {
    return new Response("잘못된 주소입니다.", { status: 404 });
  }

  const user = (await db.select().from(users).where(eq(users.calendarToken, clean)).limit(1))[0];
  if (!user) {
    return new Response("만료되었거나 존재하지 않는 캘린더 주소입니다.", { status: 404 });
  }

  const acts = await db.select().from(activities).where(eq(activities.userId, user.id));
  const entries: IcsEntry[] = [];

  for (const act of acts) {
    const status = ACTIVITY_STATUSES[act.status as ActivityStatus] ?? act.status;
    const detail = [act.organizer, `상태: ${status}`].filter(Boolean).join(" · ");
    const deadlines: Array<[string | null, string, number]> = [
      [act.applyDeadline, "지원 마감", 3],
      [act.submitDeadline, "제출 마감", 3],
      [act.announceDate, "결과 발표", 1],
    ];
    for (const [date, label, alarm] of deadlines) {
      if (!date) continue;
      entries.push({
        uid: `act-${act.id}-${label}`,
        title: `[${label}] ${act.name}`,
        date,
        description: detail,
        alarmDaysBefore: alarm,
      });
    }
    if (act.startDate && act.endDate) {
      entries.push({
        uid: `act-${act.id}-period`,
        title: `${act.name} 활동 기간`,
        date: act.startDate,
        endDate: act.endDate,
        description: detail,
      });
    }
  }

  const activityNames = new Map(acts.map((a) => [a.id, a.name]));
  const evts = await db.select().from(events).where(eq(events.userId, user.id));
  for (const evt of evts) {
    const actName = evt.activityId ? activityNames.get(evt.activityId) : undefined;
    const typeLabel = EVENT_TYPES[evt.type as EventType] ?? "";
    entries.push({
      uid: `evt-${evt.id}`,
      title: actName && !evt.title.includes(actName) ? `${actName} · ${evt.title}` : evt.title,
      date: evt.date,
      time: evt.time,
      endDate: evt.endDate,
      description: [typeLabel, evt.memo].filter(Boolean).join("\n"),
      alarmDaysBefore: 1,
    });
  }

  return new Response(buildIcs(entries, `Cavero — ${user.name}`), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="cavero.ics"',
      // 캘린더 앱이 주기적으로 다시 받아가므로 짧게만 캐시한다
      "cache-control": "private, max-age=600",
    },
  });
}
