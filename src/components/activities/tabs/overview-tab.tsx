import Link from "next/link";
import { and, desc, eq, gte } from "drizzle-orm";
import { CalendarDays, CheckCircle2, Sparkles, ListTodo, Target } from "lucide-react";
import { db, events, tasks, aiReviews, evaluationCriteria, type ActivityRow } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TaskQuickToggle } from "@/components/tasks/task-quick-toggle";
import { AISummaryCard } from "@/components/ai/ai-summary-card";
import {
  cn,
  daysUntil,
  ddayColorClass,
  ddayLabel,
  formatDate,
  todayStr,
  safeJsonParse,
} from "@/lib/utils";
import { EVENT_TYPES, CRITERIA_SOURCES, type EventType, type CriteriaSource } from "@/lib/constants";
import { announcementSummarySchema, type AnnouncementSummary } from "@/services/ai/schemas";

export async function OverviewTab({ activity, userId }: { activity: ActivityRow; userId: string }) {
  const activityTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.activityId, activity.id), eq(tasks.userId, userId)))
    .orderBy(desc(tasks.updatedAt));
  const openTasks = activityTasks.filter((t) => t.status !== "done");
  const doneCount = activityTasks.length - openTasks.length;
  const progress =
    activityTasks.length > 0 ? Math.round((doneCount / activityTasks.length) * 100) : null;

  const upcomingEvents = (await db
    .select()
    .from(events)
    .where(and(eq(events.activityId, activity.id), gte(events.date, todayStr())))
    .orderBy(events.date)
    )
    .slice(0, 5);

  const latestEval = (await db
    .select()
    .from(aiReviews)
    .where(
      and(
        eq(aiReviews.activityId, activity.id),
        eq(aiReviews.action, "evaluate_submission"),
        eq(aiReviews.status, "done"),
      ),
    )
    .orderBy(desc(aiReviews.createdAt))
    .limit(1))[0];

  const criteria = await db
    .select()
    .from(evaluationCriteria)
    .where(eq(evaluationCriteria.activityId, activity.id))
    .orderBy(evaluationCriteria.position);

  // AI 요약 (사용자가 적용한 경우)
  let aiSummary: AnnouncementSummary | null = null;
  const rawSummary = safeJsonParse<unknown>(activity.aiSummary, null);
  if (rawSummary) {
    const parsed = announcementSummarySchema.safeParse(rawSummary);
    if (parsed.success) aiSummary = parsed.data;
  }

  const dateCards = [
    { label: "지원 마감", date: activity.applyDeadline },
    { label: "결과물 제출", date: activity.submitDeadline },
    { label: "결과 발표", date: activity.announceDate },
  ].filter((d) => d.date);

  const latestEvalScore =
    latestEval?.overallScore != null && latestEval.maxScore
      ? Math.round((latestEval.overallScore / latestEval.maxScore) * 100)
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* D-day 카드 */}
        {dateCards.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {dateCards.map((d) => {
              const days = daysUntil(d.date);
              return (
                <Card key={d.label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{d.label}</p>
                    <p className={cn("mt-1 text-lg font-bold", ddayColorClass(days))}>
                      {days !== null && days >= 0 ? ddayLabel(days) : "종료"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(d.date)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* AI 요약 */}
        {aiSummary && <AISummaryCard summary={aiSummary} />}

        {/* 다가오는 일정 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" /> 다가오는 일정
            </CardTitle>
            <Link
              href={`/activities/${activity.id}?tab=calendar`}
              className="text-xs text-primary hover:underline"
            >
              전체 보기
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">예정된 일정이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.map((event) => {
                  const days = daysUntil(event.date);
                  return (
                    <li key={event.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="secondary" className="shrink-0">
                          {EVENT_TYPES[event.type as EventType] ?? event.type}
                        </Badge>
                        <span className="truncate">{event.title}</span>
                      </div>
                      <span className={cn("shrink-0 text-xs font-semibold", ddayColorClass(days))}>
                        {formatDate(event.date)} · {ddayLabel(days)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* TODO */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-1.5">
              <ListTodo className="h-4 w-4 text-muted-foreground" /> 해야 할 일
            </CardTitle>
            <Link
              href={`/activities/${activity.id}?tab=tasks`}
              className="text-xs text-primary hover:underline"
            >
              작업 보드
            </Link>
          </CardHeader>
          <CardContent>
            {openTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {activityTasks.length > 0 ? "모든 작업을 완료했습니다 🎉" : "등록된 작업이 없습니다."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {openTasks.slice(0, 6).map((task) => (
                  <TaskQuickToggle key={task.id} task={task} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {/* 진행률 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> 진행률
            </CardTitle>
          </CardHeader>
          <CardContent>
            {progress === null ? (
              <p className="text-sm text-muted-foreground">작업을 추가하면 진행률이 표시됩니다.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">{progress}%</span>
                  <span className="text-xs text-muted-foreground">
                    {doneCount}/{activityTasks.length} 완료
                  </span>
                </div>
                <Progress value={progress} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI 점수 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-muted-foreground" /> AI 예상 점수
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestEvalScore === null ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">아직 AI 평가가 없습니다.</p>
                <Link
                  href={`/activities/${activity.id}?tab=ai`}
                  className="inline-block text-xs font-medium text-primary hover:underline"
                >
                  AI 리뷰 실행하기 →
                </Link>
              </div>
            ) : (
              <Link href={`/activities/${activity.id}?tab=ai&review=${latestEval!.id}`}>
                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold text-primary">{latestEvalScore}</span>
                    <span className="text-xs text-muted-foreground">/ 100 환산</span>
                  </div>
                  <Progress value={latestEvalScore} />
                  {latestEval!.summary && (
                    <p className="line-clamp-3 text-xs text-muted-foreground">{latestEval!.summary}</p>
                  )}
                </div>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* 평가 기준 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-muted-foreground" /> 평가 기준
            </CardTitle>
            <Link
              href={`/activities/${activity.id}?tab=ai`}
              className="text-xs text-primary hover:underline"
            >
              관리
            </Link>
          </CardHeader>
          <CardContent>
            {criteria.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                공고문을 업로드하고 AI로 평가 기준을 추출해보세요.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {criteria.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{c.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {CRITERIA_SOURCES[c.source as CriteriaSource] ?? c.source}
                      </span>
                      <Badge variant="secondary">{c.weight}점</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 메모 */}
        {activity.memo && (
          <Card>
            <CardHeader>
              <CardTitle>메모</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{activity.memo}</p>
            </CardContent>
          </Card>
        )}

        {activity.contact && (
          <Card>
            <CardHeader>
              <CardTitle>담당자 / 문의처</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{activity.contact}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
