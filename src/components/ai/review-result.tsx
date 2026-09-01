import {
  ThumbsUp,
  AlertTriangle,
  Rocket,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AISummaryCard } from "@/components/ai/ai-summary-card";
import { ApplyAnnouncementPanel } from "@/components/ai/apply-announcement-panel";
import { CreateTaskButton } from "@/components/ai/create-task-button";
import type { AIReviewRow } from "@/lib/db";
import type { AIResultData } from "@/services/ai/schemas";
import { cn } from "@/lib/utils";

const DISCLAIMER =
  "이 결과는 공식 평가 기준과 업로드된 자료를 기반으로 한 AI 추정치이며 실제 심사 결과와 다를 수 있습니다.";

export function ReviewResult({
  review,
  result,
  activityId,
}: {
  review: AIReviewRow;
  result: AIResultData;
  activityId: string;
}) {
  return (
    <div className="space-y-4">
      {result.kind === "announcement" && (
        <>
          <AISummaryCard summary={result.data} />
          {(result.data.eligibility.length > 0 || result.data.prizes.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.data.eligibility.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>지원 자격</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-inside list-disc space-y-1 text-sm">
                      {result.data.eligibility.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {result.data.prizes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>시상 내역</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-inside list-disc space-y-1 text-sm">
                      {result.data.prizes.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          <ApplyAnnouncementPanel
            reviewId={review.id}
            hasDates={
              !!(
                result.data.keyDates.applyDeadline ||
                result.data.keyDates.submitDeadline ||
                result.data.keyDates.announceDate
              )
            }
            criteriaCount={result.data.criteria.length}
          />
        </>
      )}

      {result.kind === "evaluation" && (
        <EvaluationView review={review} data={result.data} activityId={activityId} />
      )}

      {result.kind === "final_check" && <FinalCheckView data={result.data} />}

      {result.kind === "advice" && (
        <AdviceView review={review} data={result.data} activityId={activityId} />
      )}

      {result.kind === "opportunity" && (
        <OpportunityRequirementsView data={result.data} activityId={activityId} />
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {DISCLAIMER}
      </p>
    </div>
  );
}

// ─── 제출물 평가 ─────────────────────────────────────────────

function EvaluationView({
  review,
  data,
  activityId,
}: {
  review: AIReviewRow;
  data: Extract<AIResultData, { kind: "evaluation" }>["data"];
  activityId: string;
}) {
  const pct = Math.round((data.overall_score / data.max_score) * 100);
  const hasInferred = data.criteria.some((c) => c.source === "inferred");

  return (
    <div className="space-y-4">
      {/* 점수 헤더 */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                예상 점수
              </p>
              <p className="mt-1 text-4xl font-bold tracking-tight">
                {Math.round(data.overall_score * 10) / 10}
                <span className="text-xl font-medium text-muted-foreground"> / {data.max_score}</span>
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>신뢰도 {Math.round(data.confidence * 100)}%</p>
              <p>provider: {review.provider}</p>
            </div>
          </div>
          <Progress value={pct} className="mt-3 h-3" />
          {data.summary && <p className="mt-3 text-sm text-muted-foreground">{data.summary}</p>}
        </CardContent>
      </Card>

      {hasInferred && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          일부 기준은 공식 평가기준이 아니라 AI가 추론한 것입니다 (표에 &lsquo;추론&rsquo; 표시).
        </p>
      )}

      {/* 항목별 점수 표 */}
      <Card>
        <CardHeader>
          <CardTitle>항목별 평가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">항목</th>
                  <th className="pb-2 text-right font-medium">점수</th>
                  <th className="pb-2 text-right font-medium">배점</th>
                  <th className="w-1/3 pb-2 pl-4 font-medium">달성률</th>
                </tr>
              </thead>
              <tbody>
                {data.criteria.map((item, i) => {
                  const itemPct = Math.round((item.score / item.max_score) * 100);
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2.5">
                        {item.name}
                        {item.source === "inferred" && (
                          <Badge variant="outline" className="ml-1.5 text-[10px]">
                            추론
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-semibold">{item.score}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{item.max_score}</td>
                      <td className="py-2.5 pl-4">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={itemPct}
                            className="h-1.5"
                            barClassName={cn(
                              itemPct < 60 && "bg-rose-500",
                              itemPct >= 60 && itemPct < 80 && "bg-amber-500",
                            )}
                          />
                          <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">
                            {itemPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 항목별 상세 피드백 */}
      <div className="space-y-3">
        {data.criteria.map((item, i) => (
          <Card key={i}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{item.name}</CardTitle>
              <span className="text-sm font-semibold">
                {item.score}
                <span className="text-muted-foreground"> / {item.max_score}</span>
              </span>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <FeedbackList
                icon={<ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />}
                title="잘한 점"
                items={item.strengths}
              />
              <FeedbackList
                icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                title="부족한 점"
                items={item.weaknesses}
              />
              <FeedbackList
                icon={<Rocket className="h-3.5 w-3.5 text-primary" />}
                title="개선 방법"
                items={item.recommendations}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {data.critical_issues.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-4 w-4" /> 치명적 문제
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {data.critical_issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.next_actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🚀 추천 개선 작업</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.next_actions.map((action, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    {i + 1}. {action}
                  </span>
                  <CreateTaskButton activityId={activityId} reviewId={review.id} title={action} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FeedbackList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        {icon} {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">-</p>
      ) : (
        <ul className="space-y-1 text-xs leading-relaxed">
          {items.map((item, i) => (
            <li key={i}>· {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── 최종 검토 ───────────────────────────────────────────────

function FinalCheckView({
  data,
}: {
  data: Extract<AIResultData, { kind: "final_check" }>["data"];
}) {
  const warnCount = data.checks.filter((c) => c.status === "warn").length;
  const failCount = data.checks.filter((c) => c.status === "fail").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Final Check
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            <p className="text-4xl font-bold tracking-tight">
              {data.score}
              <span className="text-xl font-medium text-muted-foreground"> / 100</span>
            </p>
            <div className="flex gap-2 text-xs">
              {failCount > 0 && (
                <Badge variant="destructive">치명적 문제 {failCount}</Badge>
              )}
              {warnCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  수정 권장 {warnCount}
                </Badge>
              )}
            </div>
          </div>
          <Progress value={data.score} className="mt-3 h-3" />
          {data.summary && <p className="mt-3 text-sm text-muted-foreground">{data.summary}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>체크리스트</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {data.checks.map((check, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                {check.status === "pass" && (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                )}
                {check.status === "warn" && (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                )}
                {check.status === "fail" && (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                )}
                <div>
                  <p className="font-medium">{check.label}</p>
                  {check.detail && <p className="text-xs text-muted-foreground">{check.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 공고 요구사항 추출 ──────────────────────────────────────

function OpportunityRequirementsView({
  data,
  activityId,
}: {
  data: Extract<AIResultData, { kind: "opportunity" }>["data"];
  activityId: string;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">{data.summary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.requiredSkills.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
            {data.preferredSkills.map((s) => (
              <Badge key={s} variant="outline">
                우대 · {s}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            이 추출 결과를 바탕으로 한{" "}
            <a href={`/activities/${activityId}?tab=fit`} className="text-primary hover:underline">
              지원 적합도 분석
            </a>
            을 확인하세요.
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.responsibilities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>주요 역할</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {data.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {data.qualifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>지원 자격</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {data.qualifications.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {data.submissionItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>제출물</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {data.submissionItems.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── 범용 조언 (적합도/첨삭/개선점/예상질문) ─────────────────

function AdviceView({
  review,
  data,
  activityId,
}: {
  review: AIReviewRow;
  data: Extract<AIResultData, { kind: "advice" }>["data"];
  activityId: string;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          {data.headline && <p className="text-base font-semibold">{data.headline}</p>}
          {data.score !== null && data.score !== undefined && (
            <>
              <p className="mt-2 text-4xl font-bold tracking-tight">
                {data.score}
                <span className="text-xl font-medium text-muted-foreground"> / 100</span>
              </p>
              <Progress value={data.score} className="mt-3 h-3" />
            </>
          )}
          {data.summary && <p className="mt-3 text-sm text-muted-foreground">{data.summary}</p>}
        </CardContent>
      </Card>

      {data.sections.map((section, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle>{section.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm leading-relaxed">
              {section.items.map((item, j) => (
                <li key={j}>· {item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {data.next_actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>다음에 할 일</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.next_actions.map((action, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    {i + 1}. {action}
                  </span>
                  <CreateTaskButton activityId={activityId} reviewId={review.id} title={action} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
