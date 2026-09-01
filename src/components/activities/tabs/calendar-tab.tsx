import { and, eq } from "drizzle-orm";
import { CalendarDays } from "lucide-react";
import { db, events, type ActivityRow } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EventFormDialog } from "@/components/calendar/event-form-dialog";
import { DeleteEventButton } from "@/components/calendar/delete-event-button";
import { cn, daysUntil, ddayColorClass, ddayLabel, formatDate, todayStr } from "@/lib/utils";
import { EVENT_TYPES, type EventType } from "@/lib/constants";

export function CalendarTab({ activity, userId }: { activity: ActivityRow; userId: string }) {
  const allEvents = db
    .select()
    .from(events)
    .where(and(eq(events.activityId, activity.id), eq(events.userId, userId)))
    .orderBy(events.date)
    .all();

  const today = todayStr();
  const upcoming = allEvents.filter((e) => e.date >= today);
  const past = allEvents.filter((e) => e.date < today).reverse();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          이 활동의 일정 {allEvents.length}건
        </p>
        <EventFormDialog activityId={activity.id} />
      </div>

      {allEvents.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="등록된 일정이 없습니다"
          description="지원 마감, OT, 제출 마감 등 이 활동의 일정을 추가해보세요. 활동의 마감일을 입력하면 자동으로 일정이 생성됩니다."
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                예정된 일정
              </h3>
              <ul className="divide-y rounded-lg border bg-card">
                {upcoming.map((event) => (
                  <EventRowItem key={event.id} event={event} />
                ))}
              </ul>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                지난 일정
              </h3>
              <ul className="divide-y rounded-lg border bg-card opacity-70">
                {past.map((event) => (
                  <EventRowItem key={event.id} event={event} past />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EventRowItem({
  event,
  past,
}: {
  event: typeof events.$inferSelect;
  past?: boolean;
}) {
  const days = daysUntil(event.date);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="w-24 shrink-0">
        <p className="text-sm font-medium">{formatDate(event.date)}</p>
        {event.time && <p className="text-xs text-muted-foreground">{event.time}</p>}
      </div>
      <Badge variant="secondary" className="shrink-0">
        {EVENT_TYPES[event.type as EventType] ?? event.type}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{event.title}</p>
        {event.memo && <p className="truncate text-xs text-muted-foreground">{event.memo}</p>}
      </div>
      {!past && days !== null && (
        <span className={cn("shrink-0 text-xs font-semibold", ddayColorClass(days))}>
          {ddayLabel(days)}
        </span>
      )}
      <div className="flex shrink-0 items-center">
        <EventFormDialog activityId={event.activityId} event={event} triggerVariant="icon" />
        <DeleteEventButton eventId={event.id} />
      </div>
    </li>
  );
}
