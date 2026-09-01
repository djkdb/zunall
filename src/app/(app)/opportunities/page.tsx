import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Crosshair, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db, activities, opportunityAnalyses } from "@/lib/db";
import { getCareerContext } from "@/lib/career-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalyzeFitButton } from "@/components/career/analyze-fit-button";
import { nearestDeadlineOf } from "@/lib/queries";
import {
  ACTIVITY_TYPES,
  ACTIVITY_STATUSES,
  STATUS_BADGE_CLASSES,
  FINISHED_STATUSES,
  type ActivityType,
  type ActivityStatus,
} from "@/lib/constants";
import { cn, ddayColorClass, ddayDotClass, ddayLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Opportunities" };

const REC_BADGES: Record<string, { label: string; className: string }> = {
  apply: { label: "지원 추천", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  hold: { label: "보강 후 지원", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  skip: { label: "지원 비추천", className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
};

export default async function OpportunitiesPage() {
  const user = await requireUser();
  const ctx = getCareerContext(user.id);

  const acts = db
    .select()
    .from(activities)
    .where(eq(activities.userId, user.id))
    .orderBy(desc(activities.updatedAt))
    .all()
    .filter((a) => !(FINISHED_STATUSES as string[]).includes(a.status));

  const analyses = db
    .select()
    .from(opportunityAnalyses)
    .where(eq(opportunityAnalyses.userId, user.id))
    .all();
  const analysisByActivity = new Map(analyses.map((a) => [a.activityId, a]));

  // 분석된 것은 적합도 높은 순, 미분석은 뒤로
  const sorted = [...acts].sort((a, b) => {
    const fa = analysisByActivity.get(a.id)?.fitScore ?? -1;
    const fb = analysisByActivity.get(b.id)?.fitScore ?? -1;
    return fb - fa;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Opportunities</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            &ldquo;좋은 기회인가?&rdquo;가 아니라 &ldquo;지금의 나에게 좋은 기회인가?&rdquo;를
            판단합니다.
            {ctx.goal && ` 기준 목표: ${ctx.goal.name}`}
          </p>
        </div>
        <Link href="/activities/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> 기회 등록
          </Button>
        </Link>
      </div>

      {!ctx.onboarded && (
        <div className="rounded-lg border border-primary/40 bg-accent/40 p-4 text-sm">
          적합도 분석을 사용하려면 먼저{" "}
          <Link href="/career" className="font-medium text-primary hover:underline">
            Career Profile
          </Link>
          을 만들어주세요.
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={Crosshair}
          title="진행 중인 기회가 없습니다"
          description="공모전, 대외활동, 채용 공고를 등록하면 내 커리어 목표 기준으로 지원 가치를 분석해드립니다."
          action={
            <Link href="/activities/new">
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4" /> 기회 등록
              </Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {sorted.map((activity) => {
            const analysis = analysisByActivity.get(activity.id);
            const deadline = nearestDeadlineOf(activity);
            const rec = analysis?.recommendation ? REC_BADGES[analysis.recommendation] : null;
            return (
              <li
                key={activity.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: activity.color }}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/activities/${activity.id}?tab=fit`}
                    className="block truncate font-semibold hover:text-primary"
                  >
                    {activity.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary">
                      {ACTIVITY_TYPES[activity.type as ActivityType] ?? activity.type}
                    </Badge>
                    <Badge className={STATUS_BADGE_CLASSES[activity.status as ActivityStatus] ?? ""}>
                      {ACTIVITY_STATUSES[activity.status as ActivityStatus] ?? activity.status}
                    </Badge>
                    {activity.organizer && <span>{activity.organizer}</span>}
                    {deadline && (
                      <span className={cn("flex items-center gap-1 font-semibold", ddayColorClass(deadline.days))}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", ddayDotClass(deadline.days))} />
                        {deadline.label} {ddayLabel(deadline.days)}
                      </span>
                    )}
                  </div>
                  {analysis?.recommendation === "skip" && analysis.recommendationReason && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {analysis.recommendationReason}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {analysis ? (
                    <>
                      <div className="text-right">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          적합도
                        </p>
                        <p className="text-xl font-bold leading-none">
                          {Math.round(analysis.fitScore ?? 0)}
                        </p>
                      </div>
                      {rec && <Badge className={rec.className}>{rec.label}</Badge>}
                    </>
                  ) : ctx.onboarded ? (
                    <AnalyzeFitButton activityId={activity.id} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
