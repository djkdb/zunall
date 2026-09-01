import { Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ReadinessResult } from "@/services/score/readiness";

/**
 * Career Readiness 카드.
 * 합격 확률이 아닌 "목표 대비 준비도"이며, 반드시 산출 근거를 함께 보여준다.
 */
export function ReadinessCard({
  readiness,
  templateLabel,
  trend,
  compact,
}: {
  readiness: ReadinessResult;
  templateLabel: string;
  trend?: { monthAgo: number | null; latest: number | null };
  compact?: boolean;
}) {
  const delta =
    trend?.monthAgo != null && trend.latest != null
      ? Math.round(trend.latest - trend.monthAgo)
      : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5">
          <Gauge className="h-4 w-4 text-muted-foreground" /> Career Readiness
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          목표 &ldquo;{templateLabel}&rdquo; 기준 준비도 — 합격 확률이 아닌 규칙 기반 추정치입니다.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <p className="text-4xl font-bold tracking-tight">
            {readiness.score}
            <span className="text-lg font-medium text-muted-foreground"> / 100</span>
          </p>
          {delta !== null && delta !== 0 && (
            <span
              className={
                delta > 0
                  ? "text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                  : "text-sm font-semibold text-rose-600 dark:text-rose-400"
              }
            >
              최근 30일 {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </div>
        <Progress value={readiness.score} className="mt-2 h-2.5" />

        {!compact && (
          <ul className="mt-4 space-y-2.5">
            {readiness.items.map((item) => (
              <li key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">
                    {item.points}
                    <span className="text-muted-foreground"> / {item.max}</span>
                  </span>
                </div>
                <Progress value={(item.points / item.max) * 100} className="mt-1 h-1.5" />
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
