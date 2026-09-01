import Link from "next/link";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  FolderKanban,
  CalendarClock,
  ListTodo,
  Sparkles,
  Bell,
  ArrowRight,
  Plus,
  Compass,
  Target,
  Crosshair,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  db,
  events,
  tasks,
  notifications,
  submissions,
  submissionVersions,
  aiReviews,
  opportunityAnalyses,
} from "@/lib/db";
import { getActivitiesWithMeta } from "@/lib/queries";
import { getCareerContext, getScoreTrend } from "@/lib/career-queries";
import { ReadinessCard } from "@/components/career/readiness-card";
import { MissionCard } from "@/components/career/mission-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/components/activities/activity-card";
import { TaskQuickToggle } from "@/components/tasks/task-quick-toggle";
import {
  cn,
  daysUntil,
  ddayColorClass,
  ddayDotClass,
  ddayLabel,
  formatDate,
  relativeTime,
  toDateStr,
  todayStr,
} from "@/lib/utils";
import {
  ONGOING_STATUSES,
  EVENT_TYPES,
  NOTIFICATION_TYPES,
  type EventType,
  type NotificationType,
} from "@/lib/constants";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "늦은 밤까지 고생이 많아요 🌙";
  if (hour < 12) return "좋은 아침이에요 👋";
  if (hour < 18) return "좋은 오후예요 ☀️";
  return "좋은 저녁이에요 🌆";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayStr();
  const weekEnd = toDateStr(new Date(Date.now() + 7 * 86400000));

  const careerCtx = await getCareerContext(user.id);
  const scoreTrend = await getScoreTrend(user.id);

  const allActivities = await getActivitiesWithMeta(user.id);
  const ongoing = allActivities.filter((a) => (ONGOING_STATUSES as string[]).includes(a.status));

  // 이번 주 일정
  const weekEvents = await db
    .select()
    .from(events)
    .where(and(eq(events.userId, user.id), gte(events.date, today), lte(events.date, weekEnd)))
    .orderBy(events.date);
  const todayEvents = weekEvents.filter((e) => e.date === today);

  // 오늘/지난 마감 작업
  const openTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), inArray(tasks.status, ["todo", "in_progress", "review"])))
    .orderBy(tasks.dueDate);
  const dueTasks = openTasks
    .filter((t) => t.dueDate && t.dueDate <= weekEnd)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

  // AI 평가가 필요한 제출물: 버전은 있는데 완료 전 상태
  const subs = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.userId, user.id),
        inArray(submissions.status, ["draft", "review_needed"]),
      ),
    );
  const subIds = subs.map((s) => s.id);
  const versionedSubIds = new Set(
    subIds.length > 0
      ? (await db
          .select({ submissionId: submissionVersions.submissionId })
          .from(submissionVersions)
          .where(inArray(submissionVersions.submissionId, subIds))
          )
          .map((v) => v.submissionId)
      : [],
  );
  const needsReview = subs.filter((s) => versionedSubIds.has(s.id)).slice(0, 4);

  // 제출 예정 (마감일 있는 미제출 제출물)
  const upcomingSubs = (await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.userId, user.id), gte(submissions.dueDate, today)))
    .orderBy(submissions.dueDate)
    )
    .filter((s) => s.status !== "submitted")
    .slice(0, 4);

  // 최근 알림
  const recentNotifications = (await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    )
    .slice(0, 5);
  const unreadCount = (await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, 0)))
    ).length;

  // 전체 진행률
  const allTaskRows = await db
    .select({ status: tasks.status })
    .from(tasks)
    .where(eq(tasks.userId, user.id));
  const overallProgress =
    allTaskRows.length > 0
      ? Math.round((allTaskRows.filter((t) => t.status === "done").length / allTaskRows.length) * 100)
      : null;

  // AI 평균 점수
  const evalReviews = (await db
    .select()
    .from(aiReviews)
    .where(
      and(
        eq(aiReviews.userId, user.id),
        eq(aiReviews.action, "evaluate_submission"),
        eq(aiReviews.status, "done"),
      ),
    )
    )
    .filter((r) => r.overallScore != null && r.maxScore);

  // 마감 임박(7일 이내) + 최근 추가
  const imminent = ongoing
    .filter((a) => a.nearestDeadline && a.nearestDeadline.days <= 7)
    .sort((a, b) => a.nearestDeadline!.days - b.nearestDeadline!.days);
  const recentActivities = [...allActivities]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  const activityNameById = new Map(allActivities.map((a) => [a.id, a.name]));

  // 추천 기회: 분석 완료 + 지원 추천/보강 상위 3개
  const oppAnalyses = (await db
    .select()
    .from(opportunityAnalyses)
    .where(eq(opportunityAnalyses.userId, user.id))
    )
    .filter((a) => a.recommendation === "apply" || a.recommendation === "hold")
    .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
  const recommendedOpps = oppAnalyses
    .map((analysis) => {
      const activity = allActivities.find(
        (act) => act.id === analysis.activityId && !["won", "lost", "done"].includes(act.status),
      );
      return activity ? { analysis, activity } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* 인사 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {greeting()} {user.name}님
          </h1>
          {careerCtx.onboarded && careerCtx.profile?.headline ? (
            <p className="mt-0.5 text-sm font-medium text-primary">{careerCtx.profile.headline}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            오늘 마감 일정 {todayEvents.length}개 · 이번 주 해야 할 일 {dueTasks.length}개
            {unreadCount > 0 && ` · 읽지 않은 알림 ${unreadCount}개`}
          </p>
        </div>
        <Link href="/activities/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> 새 활동
          </Button>
        </Link>
      </div>

      {/* Career OS 영역 */}
      {careerCtx.onboarded ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <ReadinessCard
              compact
              readiness={careerCtx.readiness}
              templateLabel={careerCtx.template.label}
              trend={{
                monthAgo: scoreTrend.monthAgo,
                latest: scoreTrend.latest ?? careerCtx.readiness.score,
              }}
            />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-muted-foreground" /> Current Goal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/career" className="text-base font-semibold hover:text-primary">
                  🎯 {careerCtx.goal?.name}
                </Link>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">가장 큰 Gap</p>
                {careerCtx.gaps.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">목표 수준 달성 🎉</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {careerCtx.gaps.slice(0, 3).map((gap) => (
                      <li key={gap.skill} className="flex items-center justify-between text-sm">
                        <span>{gap.skill}</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          -{gap.gap}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/career/gaps"
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  Gap 분석 보기 <ArrowRight className="inline h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
            <MissionCard
              mission={careerCtx.mission}
              activeTask={
                careerCtx.activeAction
                  ? { title: careerCtx.activeAction.title, taskId: careerCtx.activeAction.taskId }
                  : null
              }
            />
          </div>

          {recommendedOpps.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <Crosshair className="h-4 w-4" /> 추천 기회
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {recommendedOpps.map(({ analysis, activity }) => (
                  <Link
                    key={analysis.id}
                    href={`/activities/${activity.id}?tab=fit`}
                    className="rounded-lg border bg-card p-3.5 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold">{activity.name}</p>
                      <span className="shrink-0 text-lg font-bold text-primary">
                        {Math.round(analysis.fitScore ?? 0)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {analysis.recommendationReason}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <Card className="border-primary/40 bg-gradient-to-br from-accent/60 to-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <Compass className="h-4 w-4 text-primary" /> AI Career OS를 시작해보세요
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                목표를 설정하면 내 경험을 분석해 Career Score와 부족한 부분, 오늘 가장 효과적인
                행동을 알려드립니다.
              </p>
            </div>
            <Link href="/career">
              <Button size="sm">
                Career Profile 만들기 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<FolderKanban className="h-4 w-4" />}
          label="진행 중인 활동"
          value={String(ongoing.length)}
          href="/activities?filter=ongoing"
        />
        <StatCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="이번 주 일정"
          value={String(weekEvents.length)}
          href="/calendar"
        />
        <StatCard
          icon={<ListTodo className="h-4 w-4" />}
          label="열린 작업"
          value={String(openTasks.length)}
          sub={overallProgress !== null ? `전체 진행률 ${overallProgress}%` : undefined}
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="AI 평가 실행"
          value={String(evalReviews.length)}
          href="/stats"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* TODAY / UPCOMING */}
          <Card>
            <CardHeader>
              <CardTitle>다가오는 마감</CardTitle>
            </CardHeader>
            <CardContent>
              {weekEvents.length === 0 && imminent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  이번 주 마감 일정이 없습니다. 여유를 즐기세요 ✨
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {weekEvents.slice(0, 6).map((event) => {
                    const days = daysUntil(event.date);
                    const actName = event.activityId
                      ? activityNameById.get(event.activityId)
                      : null;
                    return (
                      <li key={event.id} className="flex items-center gap-3">
                        <span
                          className={cn("h-2 w-2 shrink-0 rounded-full", ddayDotClass(days))}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{event.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {EVENT_TYPES[event.type as EventType] ?? event.type}
                            {actName ? ` · ${actName}` : ""} · {formatDate(event.date)}
                          </p>
                        </div>
                        <span className={cn("shrink-0 text-sm font-bold", ddayColorClass(days))}>
                          {ddayLabel(days)}
                        </span>
                        {event.activityId && (
                          <Link
                            href={`/activities/${event.activityId}`}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label="활동으로 이동"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* 마감 임박 활동 */}
          {imminent.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">마감 임박 활동</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {imminent.slice(0, 4).map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </section>
          )}

          {/* 최근 추가된 활동 */}
          {recentActivities.length > 0 && imminent.length === 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">최근 추가된 활동</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {recentActivities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </section>
          )}

          {allActivities.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                <FolderKanban className="mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">첫 활동을 등록해보세요</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  공모전, 대외활동, 해커톤을 등록하면 마감 관리부터 AI 평가까지 한곳에서 할 수
                  있습니다.
                </p>
                <Link href="/activities/new" className="mt-4">
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4" /> 활동 만들기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {/* 오늘 해야 할 일 */}
          <Card>
            <CardHeader>
              <CardTitle>해야 할 일</CardTitle>
            </CardHeader>
            <CardContent>
              {dueTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  이번 주 마감인 작업이 없습니다.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {dueTasks.slice(0, 7).map((task) => (
                    <TaskQuickToggle key={task.id} task={task} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* AI 평가 필요 / 제출 예정 */}
          {(needsReview.length > 0 || upcomingSubs.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>제출물 현황</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {needsReview.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">
                      AI 평가가 필요한 결과물
                    </h4>
                    <ul className="space-y-1.5">
                      {needsReview.map((s) => (
                        <li key={s.id}>
                          <Link
                            href={`/activities/${s.activityId}?tab=submissions`}
                            className="flex items-center justify-between gap-2 text-sm hover:text-primary"
                          >
                            <span className="truncate">{s.title}</span>
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {upcomingSubs.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">
                      제출 예정
                    </h4>
                    <ul className="space-y-1.5">
                      {upcomingSubs.map((s) => {
                        const days = daysUntil(s.dueDate);
                        return (
                          <li key={s.id}>
                            <Link
                              href={`/activities/${s.activityId}?tab=submissions`}
                              className="flex items-center justify-between gap-2 text-sm hover:text-primary"
                            >
                              <span className="truncate">{s.title}</span>
                              <span className={cn("shrink-0 text-xs font-semibold", ddayColorClass(days))}>
                                {ddayLabel(days)}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 최근 알림 */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-muted-foreground" /> 최근 알림
              </CardTitle>
              <Link href="/notifications" className="text-xs text-primary hover:underline">
                전체 보기
              </Link>
            </CardHeader>
            <CardContent>
              {recentNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">알림이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {recentNotifications.map((n) => (
                    <li key={n.id} className="flex items-start gap-2">
                      {n.read === 0 && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className={cn("min-w-0", n.read === 1 && "pl-3.5 opacity-60")}>
                        <p className="truncate text-xs font-medium">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {NOTIFICATION_TYPES[n.type as NotificationType] ?? n.type} ·{" "}
                          {relativeTime(n.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <Card className={cn(href && "transition-colors hover:border-primary/40")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
