import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Pencil, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getActivityHeaderUnchecked,
  nearestDeadlineOf,
} from "@/lib/queries";
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
import { InterviewTab } from "@/components/activities/tabs/interview-tab";
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

const TAB_KEYS = ["overview", "fit", "calendar", "documents", "tasks", "submissions", "essay", "interview", "ai", "notes", "history"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // 로그인 확인과 활동 머리말을 동시에 읽는다 (탭을 누를 때마다 DB 왕복 하나를 아낀다).
  // 머리말은 소유자 확인 없이 읽었으므로, 아래에서 주인을 확인하기 전에는 쓰지 않는다.
  const [user, header] = await Promise.all([requireUser(), getActivityHeaderUnchecked(id)]);
  if (!header.activity || header.activity.userId !== user.id) notFound();
  const { activity, tagNames, counts } = header;

  const rawTab = typeof sp.tab === "string" ? sp.tab : "overview";
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(rawTab)
    ? (rawTab as TabKey)
    : "overview";

  const deadline = nearestDeadlineOf(activity);

  const tabs = [
    { key: "overview", label: "요약" },
    { key: "fit", label: "적합도" },
    { key: "calendar", label: "일정", count: counts.calendar },
    { key: "documents", label: "문서", count: counts.documents },
    { key: "tasks", label: "할 일", count: counts.tasks },
    { key: "submissions", label: "제출물", count: counts.submissions },
    { key: "essay", label: "자소서" },
    { key: "interview", label: "면접", count: counts.interview },
    { key: "ai", label: "AI 분석", count: counts.ai },
    { key: "notes", label: "메모" },
    { key: "history", label: "기록", count: counts.history },
  ];

  const selectedReviewId = typeof sp.review === "string" ? sp.review : null;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col gap-3">
        {/* 폰에서는 버튼 4개가 폭을 다 가져가 제목이 한 글자씩 세로로 쪼개졌다.
            좁은 화면에서는 버튼을 제목 아래로 내린다. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: activity.color }}
              aria-hidden
            />
            <div className="min-w-0">
              <h1 className="break-keep text-xl font-bold leading-tight tracking-tight">{activity.name}</h1>
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
        {tab === "interview" && <InterviewTab activity={activity} userId={user.id} />}
        {tab === "ai" && (
          <AITab activity={activity} userId={user.id} selectedReviewId={selectedReviewId} />
        )}
        {tab === "notes" && <NotesTab activity={activity} userId={user.id} />}
        {tab === "history" && <HistoryTab activity={activity} />}
      </div>
    </div>
  );
}
