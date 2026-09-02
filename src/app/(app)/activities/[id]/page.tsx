import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Building2, Pencil, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getActivity, getActivityTagNames, nearestDeadlineOf } from "@/lib/queries";
import {
  db,
  events,
  tasks,
  documents,
  submissions,
  aiReviews,
  activityHistory,
} from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { TabNav } from "@/components/ui/tab-nav";
import { StatusSelect } from "@/components/activities/status-select";
import { DuplicateActivityButton } from "@/components/activities/duplicate-activity-button";
import { DeleteActivityButton } from "@/components/activities/delete-activity-button";
import { OverviewTab } from "@/components/activities/tabs/overview-tab";
import { FitTab } from "@/components/activities/tabs/fit-tab";
import { CalendarTab } from "@/components/activities/tabs/calendar-tab";
import { DocumentsTab } from "@/components/activities/tabs/documents-tab";
import { TasksTab } from "@/components/activities/tabs/tasks-tab";
import { SubmissionsTab } from "@/components/activities/tabs/submissions-tab";
import { EssayTab } from "@/components/activities/tabs/essay-tab";
import { AITab } from "@/components/activities/tabs/ai-tab";
import { NotesTab } from "@/components/activities/tabs/notes-tab";
import { HistoryTab } from "@/components/activities/tabs/history-tab";
import {
  ACTIVITY_TYPES,
  IMPORTANCE_LEVELS,
  type ActivityType,
  type ImportanceLevel,
} from "@/lib/constants";
import { cn, ddayColorClass, ddayDotClass, ddayLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "활동 상세" };

const TAB_KEYS = ["overview", "fit", "calendar", "documents", "tasks", "submissions", "essay", "ai", "notes", "history"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const activity = await getActivity(user.id, id);
  if (!activity) notFound();

  const rawTab = typeof sp.tab === "string" ? sp.tab : "overview";
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(rawTab)
    ? (rawTab as TabKey)
    : "overview";

  const tagNames = await getActivityTagNames(activity.id);
  const deadline = nearestDeadlineOf(activity);

  // 탭 카운트
  const counts = {
    calendar: (await db.select({ id: events.id }).from(events).where(eq(events.activityId, id))).length,
    documents: (await db.select({ id: documents.id }).from(documents).where(eq(documents.activityId, id))).length,
    tasks: (await db
      .select({ id: tasks.id, status: tasks.status })
      .from(tasks)
      .where(eq(tasks.activityId, id))
      )
      .filter((t) => t.status !== "done").length,
    submissions: (await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.activityId, id))).length,
    ai: (await db
      .select({ id: aiReviews.id })
      .from(aiReviews)
      .where(and(eq(aiReviews.activityId, id), eq(aiReviews.status, "done")))
      ).length,
    history: (await db.select({ id: activityHistory.id }).from(activityHistory).where(eq(activityHistory.activityId, id))).length,
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "fit", label: "적합도" },
    { key: "calendar", label: "일정", count: counts.calendar },
    { key: "documents", label: "문서", count: counts.documents },
    { key: "tasks", label: "작업", count: counts.tasks },
    { key: "submissions", label: "제출물", count: counts.submissions },
    { key: "essay", label: "자소서" },
    { key: "ai", label: "AI 리뷰", count: counts.ai },
    { key: "notes", label: "메모" },
    { key: "history", label: "기록", count: counts.history },
  ];

  const selectedReviewId = typeof sp.review === "string" ? sp.review : null;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: activity.color }}
              aria-hidden
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight tracking-tight">{activity.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {activity.organizer && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> {activity.organizer}
                  </span>
                )}
                {activity.link && (
                  <a
                    href={activity.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> 활동 링크
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusSelect activityId={activity.id} status={activity.status} />
            <Link
              href={`/activities/${activity.id}/edit`}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="활동 수정"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <DuplicateActivityButton activityId={activity.id} />
            <DeleteActivityButton activityId={activity.id} activityName={activity.name} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            {ACTIVITY_TYPES[activity.type as ActivityType] ?? activity.type}
          </Badge>
          <Badge variant="outline">
            중요도 {IMPORTANCE_LEVELS[activity.importance as ImportanceLevel] ?? activity.importance}
          </Badge>
          {deadline && (
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold",
                ddayColorClass(deadline.days),
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", ddayDotClass(deadline.days))} />
              {deadline.label} {ddayLabel(deadline.days)}
            </span>
          )}
          {tagNames.map((tag) => (
            <Link key={tag} href={`/activities?tag=${encodeURIComponent(tag)}`}>
              <Badge variant="outline" className="hover:bg-accent">
                #{tag}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      <TabNav tabs={tabs} active={tab} hrefPrefix={`/activities/${activity.id}?tab=`} />

      <div className="animate-fade-in">
        {tab === "overview" && <OverviewTab activity={activity} userId={user.id} />}
        {tab === "fit" && <FitTab activity={activity} userId={user.id} />}
        {tab === "calendar" && <CalendarTab activity={activity} userId={user.id} />}
        {tab === "documents" && <DocumentsTab activity={activity} userId={user.id} />}
        {tab === "tasks" && <TasksTab activity={activity} userId={user.id} />}
        {tab === "submissions" && <SubmissionsTab activity={activity} userId={user.id} />}
        {tab === "essay" && <EssayTab activity={activity} userId={user.id} />}
        {tab === "ai" && (
          <AITab activity={activity} userId={user.id} selectedReviewId={selectedReviewId} />
        )}
        {tab === "notes" && <NotesTab activity={activity} userId={user.id} />}
        {tab === "history" && <HistoryTab activity={activity} />}
      </div>
    </div>
  );
}
