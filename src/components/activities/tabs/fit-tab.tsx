import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Crosshair, CheckCircle2, AlertTriangle, Info, Lightbulb } from "lucide-react";
import { db, opportunityAnalyses, documents, type ActivityRow } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AnalyzeFitButton } from "@/components/career/analyze-fit-button";
import { getCareerContext } from "@/lib/career-queries";
import { opportunityRequirementsSchema } from "@/services/ai/schemas";
import { cn, formatDateTime, safeJsonParse } from "@/lib/utils";
import type { FitBreakdownItem } from "@/services/score/opportunity-fit";

const RECOMMENDATION_LABELS: Record<string, { label: string; className: string }> = {
  apply: {
    label: "지원 추천",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  hold: {
    label: "보강 후 지원",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  skip: {
    label: "지원 비추천",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  },
};

export async function FitTab({ activity, userId }: { activity: ActivityRow; userId: string }) {
  const [ctx, analysisRows, noticeDocs] = await Promise.all([
    getCareerContext(userId),
    db
      .select()
      .from(opportunityAnalyses)
      .where(
        and(
          eq(opportunityAnalyses.activityId, activity.id),
          eq(opportunityAnalyses.userId, userId),
        ),
      )
      .orderBy(desc(opportunityAnalyses.createdAt))
      .limit(1),
    db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.activityId, activity.id), eq(documents.category, "notice"))),
  ]);
  const analysis = analysisRows[0];
  const noticeDocCount = noticeDocs.length;

  if (!ctx.onboarded) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <Crosshair className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Career Profile이 필요합니다</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            지원 적합도는 나의 목표·스킬·근거와 공고 요구사항을 비교해 계산됩니다. 먼저 커리어
            프로필을 만들어주세요.
          </p>
          <Link href="/career" className="mt-3 text-sm font-medium text-primary hover:underline">
            내 커리어 시작하기 →
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <Crosshair className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">아직 적합도 분석을 실행하지 않았습니다</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            AI가 공고에서 요구 역량을 추출하고, 내 Career Profile과 비교해 &ldquo;지금의 나에게
            좋은 기회인지&rdquo;를 판단합니다.
            {noticeDocCount === 0 &&
              " 정확한 분석을 위해 문서 탭에 '공고 / 안내' 파일을 먼저 업로드하는 것을 권장합니다."}
          </p>
          <div className="mt-4">
            <AnalyzeFitButton activityId={activity.id} />
          </div>
        </CardContent>
      </Card>
    );
  }

  const requirements = opportunityRequirementsSchema.safeParse(
    safeJsonParse<unknown>(analysis.requirements, null),
  );
  const fitDetail = safeJsonParse<{
    breakdown: FitBreakdownItem[];
    strengths: string[];
    weaknesses: string[];
  }>(analysis.fitBreakdown, { breakdown: [], strengths: [], weaknesses: [] });
  const alternative = safeJsonParse<{ title: string; effect: number; minutes: number } | null>(
    analysis.alternative,
    null,
  );
  const rec = RECOMMENDATION_LABELS[analysis.recommendation ?? "hold"];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* 점수 헤더 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  지원 적합도
                </p>
                <p className="mt-1 text-4xl font-bold tracking-tight">
                  {Math.round(analysis.fitScore ?? 0)}
                  <span className="text-xl font-medium text-muted-foreground"> / 100</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {rec && <Badge className={rec.className}>{rec.label}</Badge>}
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(analysis.createdAt)}
                </span>
              </div>
            </div>
            <Progress value={analysis.fitScore ?? 0} className="mt-3 h-3" />
            {analysis.recommendationReason && (
              <p className="mt-3 text-sm text-muted-foreground">{analysis.recommendationReason}</p>
            )}
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span>예상 준비 시간 {analysis.prepHours}시간</span>
              <span>
                부족한 부분을 얼마나 메우나{" "}
                <b className={cn((analysis.gapEffect ?? 0) >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                  +{analysis.gapEffect}
                </b>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 지원 비추천 시 대안 */}
        {analysis.recommendation === "skip" && alternative && (
          <Card className="border-amber-300/60 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4 text-amber-500" /> 지금 더 효과적인 대안
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{alternative.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                예상 효과 커리어 점수 +{alternative.effect} · 약{" "}
                {Math.round((alternative.minutes / 60) * 10) / 10}시간 — 이 공고를 준비하는{" "}
                {analysis.prepHours}시간 대비 목표에 더 직접적입니다.
              </p>
              <Link
                href="/career/gaps"
                className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
              >
                부족한 부분에서 실행하기 →
              </Link>
            </CardContent>
          </Card>
        )}

        {/* 판단 근거 */}
        <Card>
          <CardHeader>
            <CardTitle>판단 근거</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {fitDetail.breakdown.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {item.type === "plus" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    )}
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold",
                      item.points >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {item.points >= 0 ? `+${item.points}` : item.points}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              이 점수는 내 프로필의 근거와 공고 요구사항을 비교한 규칙 기반 추정치이며, 실제 합격
              가능성과 다를 수 있습니다.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>✓ 강점</CardTitle>
            </CardHeader>
            <CardContent>
              {fitDetail.strengths.length === 0 ? (
                <p className="text-sm text-muted-foreground">-</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {fitDetail.strengths.map((s, i) => (
                    <li key={i}>✓ {s}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>⚠ 보완 필요</CardTitle>
            </CardHeader>
            <CardContent>
              {fitDetail.weaknesses.length === 0 ? (
                <p className="text-sm text-muted-foreground">-</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {fitDetail.weaknesses.map((w, i) => (
                    <li key={i}>⚠ {w}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        {requirements.success && (
          <Card>
            <CardHeader>
              <CardTitle>공고 요구사항 (AI 추출)</CardTitle>
              {requirements.data.summary && (
                <p className="text-xs text-muted-foreground">{requirements.data.summary}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {requirements.data.requiredSkills.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">요구 역량</p>
                  <div className="flex flex-wrap gap-1">
                    {requirements.data.requiredSkills.map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {requirements.data.preferredSkills.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">우대 역량</p>
                  <div className="flex flex-wrap gap-1">
                    {requirements.data.preferredSkills.map((s) => (
                      <Badge key={s} variant="outline">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {requirements.data.qualifications.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">지원 자격</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs">
                    {requirements.data.qualifications.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {requirements.data.submissionItems.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">제출물</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs">
                    {requirements.data.submissionItems.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <AnalyzeFitButton activityId={activity.id} rerun />
      </div>
    </div>
  );
}
