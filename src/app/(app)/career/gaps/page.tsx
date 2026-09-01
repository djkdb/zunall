import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, TrendingDown } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCareerContext } from "@/lib/career-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { ReadinessCard } from "@/components/career/readiness-card";
import { AcceptActionButton } from "@/components/career/accept-action-button";

export const metadata: Metadata = { title: "Career Gaps" };

export default async function GapsPage() {
  const user = await requireUser();
  const ctx = await getCareerContext(user.id);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/career"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Career Profile
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Career Gap 분석</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          목표 &ldquo;{ctx.goal?.name ?? "미설정"}&rdquo; ({ctx.template.label} 기준) 대비 부족한
          역량과, 그 격차를 줄이는 가장 효과적인 행동입니다.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {ctx.gaps.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="Gap이 없습니다"
              description={
                ctx.goal
                  ? "모든 요구 역량이 목표 수준에 도달했습니다. 목표를 더 높여보세요!"
                  : "먼저 Career Profile에서 목표를 설정해주세요."
              }
            />
          ) : (
            ctx.gaps.map((gap) => (
              <Card key={gap.skill}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{gap.skill}</CardTitle>
                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      -{gap.gap}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      현재 <b className="text-foreground">{gap.current}</b>
                    </span>
                    <div className="relative max-w-48 flex-1">
                      <Progress value={(gap.current / gap.target) * 100} className="h-1.5" />
                    </div>
                    <span>
                      목표 <b className="text-foreground">{gap.target}</b>
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md bg-secondary/50 p-3 text-xs leading-relaxed">
                    <p>
                      <b>왜 필요한가?</b> {gap.whyNeeded}
                    </p>
                    <p className="mt-1">
                      <b>왜 부족한가?</b> {gap.whyLacking}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">추천 행동</p>
                    <ul className="space-y-2">
                      {gap.actions.map((action, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-3 rounded-md border p-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {i + 1}. {action.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              예상 효과{" "}
                              <b className="text-emerald-600 dark:text-emerald-400">
                                Career Score +{action.effect}
                              </b>{" "}
                              · 약 {Math.round((action.minutes / 60) * 10) / 10}시간 —{" "}
                              {action.reason}
                            </p>
                          </div>
                          <AcceptActionButton
                            skill={gap.skill}
                            title={action.title}
                            reason={action.reason}
                            effect={action.effect}
                            minutes={action.minutes}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <ReadinessCard readiness={ctx.readiness} templateLabel={ctx.template.label} />
        </div>
      </div>
    </div>
  );
}
