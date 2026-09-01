import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell, CalendarClock, FileText, Sparkles, Info } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db, notifications, activities } from "@/lib/db";
import { TabNav } from "@/components/ui/tab-nav";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MarkAllReadButton,
  NotificationItemActions,
} from "@/components/notifications/notification-actions";
import { cn, relativeTime } from "@/lib/utils";
import type { NotificationType } from "@/lib/constants";

export const metadata: Metadata = { title: "알림" };

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  schedule: CalendarClock,
  file: FileText,
  ai: Sparkles,
  system: Info,
};

const FILTERS = [
  { key: "unread", label: "읽지 않음" },
  { key: "all", label: "전체" },
  { key: "schedule", label: "일정" },
  { key: "file", label: "파일" },
  { key: "ai", label: "AI 평가" },
] as const;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const rawFilter = typeof params.filter === "string" ? params.filter : "unread";
  const filter = FILTERS.some((f) => f.key === rawFilter) ? rawFilter : "unread";

  const all = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .all();

  const unreadCount = all.filter((n) => n.read === 0).length;

  const items =
    filter === "all"
      ? all
      : filter === "unread"
        ? all.filter((n) => n.read === 0)
        : all.filter((n) => n.type === filter);

  const activityRows = await db
    .select({ id: activities.id, name: activities.name })
    .from(activities)
    .where(eq(activities.userId, user.id))
    .all();
  const activityNameById = new Map(activityRows.map((a) => [a.id, a.name]));

  const tabs = FILTERS.map((f) => ({
    key: f.key,
    label: f.label,
    count: f.key === "unread" ? unreadCount : undefined,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">알림</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            읽지 않은 알림 {unreadCount}개
          </p>
        </div>
        <MarkAllReadButton disabled={unreadCount === 0} />
      </div>

      <TabNav tabs={tabs} active={filter} hrefPrefix="/notifications?filter=" />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === "unread" ? "읽지 않은 알림이 없습니다" : "알림이 없습니다"}
          description="마감이 다가오면 D-7 / D-3 / D-1 / 당일에 자동으로 알림이 생성됩니다."
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((notification) => {
            const Icon = TYPE_ICONS[notification.type as NotificationType] ?? Info;
            const activityName = notification.activityId
              ? activityNameById.get(notification.activityId)
              : null;
            return (
              <li
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  notification.read === 1 && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    notification.read === 0
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{notification.title}</p>
                  {notification.body && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{notification.body}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {relativeTime(notification.createdAt)}
                    {activityName && notification.activityId && (
                      <>
                        {" · "}
                        <Link
                          href={`/activities/${notification.activityId}`}
                          className="text-primary hover:underline"
                        >
                          {activityName}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <NotificationItemActions
                  notificationId={notification.id}
                  read={notification.read === 1}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
