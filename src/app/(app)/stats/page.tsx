import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Trophy, Sparkles, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  db,
  activities,
  tasks,
  aiReviews,
  careerActions,
  opportunityAnalyses,
} from "@/lib/db";
import { getCareerContext, getScoreTrend } from "@/lib/career-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TypeDistributionChart,
  MonthlyChart,
  type TypeDistribution,
  type MonthlyCount,
} from "@/components/stats/stats-charts";
import {
  ACTIVITY_TYPES,
  ONGOING_STATUSES,
  FINISHED_STATUSES,
  type ActivityType,
} from "@/lib/constants";

export const metadata: Metadata = { title: "통계" };

export default async function StatsPage() {
  const user = await requireUser();

  const acts = await db.select().from(activities).where(eq(activities.userId, user.id));
  const allTasks = await db
    .select({ status: tasks.status })
    .from(tasks)
    .where(eq(tasks.userId, user.id));
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

  const total = acts.length;
  const ongoing = acts.filter((a) => (ONGOING_STATUSES as string[]).includes(a.status)).length;
  const finished = acts.filter((a) => (FINISHED_STATUSES as string[]).includes(a.status)).length;
  const won = acts.filter((a) => a.status === "won").length;
  const lost = acts.filter((a) => a.status === "lost").length;
  const appliedCount = acts.filter((a) => !["interested", "planned"].includes(a.status)).length;

  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;
  const doneTaskCount = allTasks.filter((t) => t.status === "done").length;
  const taskRate = allTasks.length > 0 ? Math.round((doneTaskCount / allTasks.length) * 100) : null;

  const avgAiScore =
    evalReviews.length > 0
      ? Math.round(
          evalReviews.reduce((s, r) => s + (r.overallScore! / r.maxScore!) * 100, 0) /
            evalReviews.length,
        )
      : null;

  // 분야별 분포
  const typeCount = new Map<string, number>();
  for (const act of acts) {
    typeCount.set(act.type, (typeCount.get(act.type) ?? 0) + 1);
  }
  const typeData: TypeDistribution[] = Array.from(typeCount.entries())
    .map(([type, count]) => ({
      name: ACTIVITY_TYPES[type as ActivityType] ?? type,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);

  // 최근 6개월 등록 추이
  const monthly: MonthlyCount[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getMonth() + 1}월`;
    const count = acts.filter((a) => {
      const c = new Date(a.createdAt);
      return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
    }).length;
    monthly.push({ month: label, count });
  }

  // AI 예상 vs 실제 결과
  const aiVsActual = acts
    .filter((a) => a.status === "won" || a.status === "lost")
    .map((act) => {
      const review = evalReviews
        .filter((r) => r.activityId === act.id)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!review) return null;
      return {
        id: act.id,
        name: act.name,
        aiScore: Math.round((review.overallScore! / review.maxScore!) * 100),
        result: act.status as "won" | "lost",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">통계</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          나의 대외활동 데이터를 분석합니다.
        </p>
      </div>

      {/* Career 지표 */}
      <CareerStatsSection userId={user.id} />

      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="총 참여 활동" value={String(total)} />
        <MetricCard label="진행 중" value={String(ongoing)} />
        <MetricCard label="완료" value={String(finished)} />
        <MetricCard label="지원" value={String(appliedCount)} />
        <MetricCard
          label="수상"
          value={String(won)}
          sub={winRate !== null ? `수상률 ${winRate}%` : undefined}
          highlight
        />
        <MetricCard
          label="작업 완료율"
          value={taskRate !== null ? `${taskRate}%` : "-"}
          sub={allTasks.length > 0 ? `${doneTaskCount}/${allTasks.length}` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TypeDistributionChart data={typeData} />
        <MonthlyChart data={monthly} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI 점수 통계 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-muted-foreground" /> AI 평가 통계
            </CardTitle>
          </CardHeader>
          <CardContent>
            {avgAiScore === null ? (
              <p className="text-sm text-muted-foreground">
                아직 AI 제출물 평가 기록이 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold">{avgAiScore}</span>
                  <span className="pb-1 text-sm text-muted-foreground">
                    / 100 · 평균 예상 점수 ({evalReviews.length}회 평가)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  제출물 평가 액션의 점수를 100점 만점으로 환산한 평균입니다.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI 예상 vs 실제 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> AI 예상 vs 실제 결과
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aiVsActual.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                AI 평가를 받은 뒤 수상/탈락이 확정된 활동이 생기면 비교가 표시됩니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {aiVsActual.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      href={`/activities/${row.id}`}
                      className="min-w-0 flex-1 truncate hover:text-primary"
                    >
                      {row.name}
                    </Link>
                    <Badge variant="secondary">AI {row.aiScore}</Badge>
                    {row.result === "won" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <Trophy className="h-3 w-3" /> 수상
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        탈락
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function CareerStatsSection({ userId }: { userId: string }) {
  const ctx = await getCareerContext(userId);
  if (!ctx.onboarded) return null;

  const trend = await getScoreTrend(userId);
  const monthAgo = trend.monthAgo != null ? Math.round(trend.monthAgo) : null;
  const latest = Math.round(trend.latest ?? ctx.readiness.score);

  const actions = (await db
    .select({ status: careerActions.status })
    .from(careerActions)
    .where(eq(careerActions.userId, userId))
    )
    .filter((a) => a.status === "accepted" || a.status === "done");
  const doneActions = actions.filter((a) => a.status === "done").length;
  const actionRate = actions.length > 0 ? Math.round((doneActions / actions.length) * 100) : null;

  const fits = (await db
    .select({ fitScore: opportunityAnalyses.fitScore })
    .from(opportunityAnalyses)
    .where(eq(opportunityAnalyses.userId, userId))
    )
    .filter((f) => f.fitScore != null);
  const avgFit =
    fits.length > 0
      ? Math.round(fits.reduce((s, f) => s + (f.fitScore ?? 0), 0) / fits.length)
      : null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Career</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Career Score"
          value={String(latest)}
          sub={
            monthAgo !== null && monthAgo !== latest
              ? `최근 30일 ${monthAgo} → ${latest}`
              : "합격 확률이 아닌 준비도"
          }
          highlight
        />
        <MetricCard label="가장 큰 Gap" value={ctx.gaps[0] ? `-${ctx.gaps[0].gap}` : "-"} sub={ctx.gaps[0]?.skill} />
        <MetricCard label="근거 (Evidence)" value={String(ctx.evidence.length)} sub={`스킬 ${ctx.skillScores.length}개 뒷받침`} />
        <MetricCard
          label="추천 행동 완료율"
          value={actionRate !== null ? `${actionRate}%` : "-"}
          sub={actions.length > 0 ? `${doneActions}/${actions.length} 완료` : "시작한 미션 없음"}
        />
        <MetricCard
          label="평균 지원 적합도"
          value={avgFit !== null ? String(avgFit) : "-"}
          sub={fits.length > 0 ? `기회 ${fits.length}개 분석` : "분석한 기회 없음"}
        />
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
