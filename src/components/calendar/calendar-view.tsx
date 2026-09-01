"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventFormDialog } from "@/components/calendar/event-form-dialog";
import { DeleteEventButton } from "@/components/calendar/delete-event-button";
import { EVENT_TYPES, type EventType } from "@/lib/constants";
import {
  cn,
  daysUntil,
  ddayColorClass,
  ddayLabel,
  formatDate,
  toDateStr,
  todayStr,
} from "@/lib/utils";
import type { EventRow } from "@/lib/db";

interface ActivityOption {
  id: string;
  name: string;
  color: string;
}

type ViewMode = "month" | "week" | "list";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function CalendarView({
  events,
  activities,
}: {
  events: EventRow[];
  activities: ActivityOption[];
}) {
  const [view, setView] = React.useState<ViewMode>("month");
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [activityFilter, setActivityFilter] = React.useState<string>("all");

  const colorById = React.useMemo(
    () => new Map(activities.map((a) => [a.id, a.color])),
    [activities],
  );
  const nameById = React.useMemo(
    () => new Map(activities.map((a) => [a.id, a.name])),
    [activities],
  );

  const filtered = React.useMemo(
    () =>
      activityFilter === "all"
        ? events
        : activityFilter === "none"
          ? events.filter((e) => !e.activityId)
          : events.filter((e) => e.activityId === activityFilter),
    [events, activityFilter],
  );

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const event of filtered) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [filtered]);

  function navigate(delta: number) {
    setCursor((prev) => {
      const next = new Date(prev);
      if (view === "month") next.setMonth(next.getMonth() + delta);
      else if (view === "week") next.setDate(next.getDate() + delta * 7);
      return next;
    });
  }

  const title =
    view === "week"
      ? `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월 ${weekOfMonth(cursor)}주차`
      : `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {view !== "list" && (
            <>
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="이전">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate(1)} aria-label="다음">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <h2 className="ml-1 text-base font-semibold">{view === "list" ? "일정 목록" : title}</h2>
          {view !== "list" && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 text-xs"
              onClick={() => setCursor(new Date())}
            >
              오늘
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="활동 필터"
          >
            <option value="all">모든 활동</option>
            <option value="none">활동 없는 일정</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="flex rounded-md border p-0.5">
            {(["month", "week", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  view === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode === "month" ? "월간" : mode === "week" ? "주간" : "목록"}
              </button>
            ))}
          </div>
          <EventFormDialog activityOptions={activities} />
        </div>
      </div>

      {view === "month" && (
        <MonthGrid cursor={cursor} eventsByDate={eventsByDate} colorById={colorById} />
      )}
      {view === "week" && (
        <WeekView cursor={cursor} eventsByDate={eventsByDate} colorById={colorById} nameById={nameById} activities={activities} />
      )}
      {view === "list" && (
        <ListView events={filtered} colorById={colorById} nameById={nameById} activities={activities} />
      )}
    </div>
  );
}

function weekOfMonth(d: Date): number {
  return Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
}

// ─── 월간 뷰 ─────────────────────────────────────────────────

function MonthGrid({
  cursor,
  eventsByDate,
  colorById,
}: {
  cursor: Date;
  eventsByDate: Map<string, EventRow[]>;
  colorById: Map<string, string>;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const today = todayStr();

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] rounded-lg border bg-card">
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={cn(
                "px-2 py-1.5 text-center text-xs font-medium text-muted-foreground",
                i === 0 && "text-rose-500",
                i === 6 && "text-sky-500",
              )}
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            const dateStr = toDateStr(date);
            const inMonth = date.getMonth() === month;
            const dayEvents = eventsByDate.get(dateStr) ?? [];
            const isToday = dateStr === today;
            return (
              <div
                key={i}
                className={cn(
                  "min-h-24 border-b border-r p-1 [&:nth-child(7n)]:border-r-0",
                  i >= 35 && "border-b-0",
                  !inMonth && "bg-secondary/30 dark:bg-secondary/10",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                    !inMonth && "text-muted-foreground/50",
                    isToday && "bg-primary font-bold text-primary-foreground",
                  )}
                >
                  {date.getDate()}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <EventChip key={event.id} event={event} colorById={colorById} />
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="px-1 text-[10px] text-muted-foreground">
                      +{dayEvents.length - 3}개 더
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventChip({
  event,
  colorById,
}: {
  event: EventRow;
  colorById: Map<string, string>;
}) {
  const color = event.activityId ? (colorById.get(event.activityId) ?? "#94a3b8") : "#94a3b8";
  const chip = (
    <div
      className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight"
      style={{ backgroundColor: `${color}22`, color }}
      title={`${event.title}${event.time ? ` (${event.time})` : ""}`}
    >
      <span className="h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate font-medium">{event.title}</span>
    </div>
  );
  return event.activityId ? (
    <Link href={`/activities/${event.activityId}?tab=calendar`}>{chip}</Link>
  ) : (
    chip
  );
}

// ─── 주간 뷰 ─────────────────────────────────────────────────

function WeekView({
  cursor,
  eventsByDate,
  colorById,
  nameById,
  activities,
}: {
  cursor: Date;
  eventsByDate: Map<string, EventRow[]>;
  colorById: Map<string, string>;
  nameById: Map<string, string>;
  activities: ActivityOption[];
}) {
  const weekStart = new Date(cursor);
  weekStart.setDate(cursor.getDate() - cursor.getDay());
  const today = todayStr();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((date, i) => {
        const dateStr = toDateStr(date);
        const dayEvents = eventsByDate.get(dateStr) ?? [];
        const isToday = dateStr === today;
        return (
          <div
            key={dateStr}
            className={cn(
              "rounded-lg border bg-card p-2",
              isToday && "border-primary/50 ring-1 ring-primary/30",
            )}
          >
            <p
              className={cn(
                "mb-1.5 text-xs font-semibold",
                i === 0 && "text-rose-500",
                i === 6 && "text-sky-500",
              )}
            >
              {WEEKDAYS[i]} {date.getDate()}
              {isToday && <span className="ml-1 text-primary">오늘</span>}
            </p>
            {dayEvents.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60">일정 없음</p>
            ) : (
              <ul className="space-y-1.5">
                {dayEvents.map((event) => (
                  <ListEventItem
                    key={event.id}
                    event={event}
                    colorById={colorById}
                    nameById={nameById}
                    activities={activities}
                    compact
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 목록 뷰 ─────────────────────────────────────────────────

function ListView({
  events,
  colorById,
  nameById,
  activities,
}: {
  events: EventRow[];
  colorById: Map<string, string>;
  nameById: Map<string, string>;
  activities: ActivityOption[];
}) {
  const today = todayStr();
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const past = events.filter((e) => e.date < today).sort((a, b) => (a.date > b.date ? -1 : 1));

  if (events.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">등록된 일정이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          예정된 일정 ({upcoming.length})
        </h3>
        <ul className="divide-y rounded-lg border bg-card">
          {upcoming.map((event) => (
            <ListEventItem
              key={event.id}
              event={event}
              colorById={colorById}
              nameById={nameById}
              activities={activities}
            />
          ))}
          {upcoming.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              예정된 일정이 없습니다.
            </li>
          )}
        </ul>
      </section>
      {past.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            지난 일정 ({past.length})
          </h3>
          <ul className="divide-y rounded-lg border bg-card opacity-70">
            {past.slice(0, 20).map((event) => (
              <ListEventItem
                key={event.id}
                event={event}
                colorById={colorById}
                nameById={nameById}
                activities={activities}
                past
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ListEventItem({
  event,
  colorById,
  nameById,
  activities,
  compact,
  past,
}: {
  event: EventRow;
  colorById: Map<string, string>;
  nameById: Map<string, string>;
  activities: ActivityOption[];
  compact?: boolean;
  past?: boolean;
}) {
  const color = event.activityId ? (colorById.get(event.activityId) ?? "#94a3b8") : "#94a3b8";
  const actName = event.activityId ? nameById.get(event.activityId) : null;
  const days = daysUntil(event.date);

  if (compact) {
    return (
      <li className="flex items-start gap-1.5 text-xs">
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="min-w-0">
          <p className="truncate font-medium">{event.title}</p>
          {event.time && <p className="text-[10px] text-muted-foreground">{event.time}</p>}
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="w-24 shrink-0">
        <p className="text-sm font-medium">{formatDate(event.date)}</p>
        {event.time && <p className="text-xs text-muted-foreground">{event.time}</p>}
      </div>
      <Badge variant="secondary" className="shrink-0">
        {EVENT_TYPES[event.type as EventType] ?? event.type}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{event.title}</p>
        {actName && (
          <Link
            href={`/activities/${event.activityId}`}
            className="truncate text-xs text-muted-foreground hover:text-primary"
          >
            {actName}
          </Link>
        )}
      </div>
      {!past && days !== null && (
        <span className={cn("shrink-0 text-xs font-semibold", ddayColorClass(days))}>
          {ddayLabel(days)}
        </span>
      )}
      <div className="flex shrink-0 items-center">
        <EventFormDialog
          activityId={event.activityId}
          activityOptions={activities}
          event={event}
          triggerVariant="icon"
        />
        <DeleteEventButton eventId={event.id} />
      </div>
    </li>
  );
}
