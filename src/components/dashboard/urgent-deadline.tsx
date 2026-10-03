import Link from "next/link";
import { AlarmClock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deadlineLabels } from "@/lib/constants";
import { ddayLabel } from "@/lib/utils";

const RECOMMENDATION = {
  apply: { label: "지원 추천", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  hold: { label: "보강 후 지원", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  skip: { label: "지원 비추천", className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
} as const;

/**
 * 오늘 가장 급한 것.
 *
 * 3일 뒤 공모전 마감이 있는데 "오늘의 한 걸음"이 "브랜드 분석 글 쓰기"였다.
 * 마감 관리와 커리어 추천이 따로 놀았다. 마감이 코앞이면 그것부터 보여주고,
 * 그 공고에 대한 지원 판단이 있으면 같이 보여줘 "할지 말지"를 여기서 정하게 한다.
 */
export function UrgentDeadlineCard({
  activity,
  deadline,
  analysis,
}: {
  activity: { id: string; name: string; type?: string | null };
  deadline: { days: number; label: string };
  analysis: { recommendation: string | null; recommendationReason: string | null } | null;
}) {
  // "지원할지 판단"은 지원 마감 앞에서만 말이 된다. 이미 접수한 시험의 시험일, 봉사 확인서 제출일에
  // 적합도를 따지라고 하면 엉뚱하다.
  const decidable =
    !["exam", "volunteer"].includes(activity.type ?? "") && deadline.label === deadlineLabels(activity.type).apply;
  const rec = analysis?.recommendation
    ? RECOMMENDATION[analysis.recommendation as keyof typeof RECOMMENDATION]
    : null;

  return (
    <Card className="border-amber-300/70 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
            <AlarmClock className="h-4 w-4" /> 오늘 가장 급한 것
          </p>
          <p className="mt-1 break-keep text-base font-semibold leading-snug">
            {activity.name} — {deadline.label} {ddayLabel(deadline.days)}
          </p>
          {analysis && rec ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge className={rec.className}>{rec.label}</Badge>
              <span className="min-w-0">{analysis.recommendationReason}</span>
            </p>
          ) : decidable ? (
            <p className="mt-1 text-xs text-muted-foreground">
              아직 지원할지 판단하지 않았습니다. 시간을 쓰기 전에 적합도부터 확인해 보세요.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              얼마 남지 않았습니다. 오늘 할 일부터 정해 두세요.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!analysis && decidable && (
            <Link
              href={`/activities/${activity.id}?tab=fit`}
              className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              지원할지 판단
            </Link>
          )}
          <Link
            href={`/activities/${activity.id}?tab=tasks`}
            className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            준비 시작 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
