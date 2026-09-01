import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db, events, activities } from "@/lib/db";
import { CalendarView } from "@/components/calendar/calendar-view";

export const metadata: Metadata = { title: "캘린더" };

export default async function CalendarPage() {
  const user = await requireUser();

  const allEvents = db
    .select()
    .from(events)
    .where(eq(events.userId, user.id))
    .orderBy(events.date)
    .all();

  const activityOptions = db
    .select({ id: activities.id, name: activities.name, color: activities.color })
    .from(activities)
    .where(eq(activities.userId, user.id))
    .all();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">캘린더</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          모든 활동의 일정을 한눈에 확인하세요. 활동별 색상으로 구분됩니다.
        </p>
      </div>
      <CalendarView events={allEvents} activities={activityOptions} />
    </div>
  );
}
