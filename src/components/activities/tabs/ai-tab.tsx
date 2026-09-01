import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Target, Sparkles, AlertCircle } from "lucide-react";
import {
  db,
  aiReviews,
  evaluationCriteria,
  submissions,
  documents,
  type ActivityRow,
} from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RunAIButton } from "@/components/ai/run-ai-button";
import { CriteriaManager } from "@/components/ai/criteria-manager";
import { ReviewResult } from "@/components/ai/review-result";
import { parseReviewResult } from "@/services/ai/evaluator";
import { getProviderName } from "@/services/ai/provider";
import { AI_ACTIONS, type AIAction } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";

export async function AITab({
  activity,
  userId,
  selectedReviewId,
}: {
  activity: ActivityRow;
  userId: string;
  selectedReviewId: string | null;
}) {
  const criteria = await db
    .select()
    .from(evaluationCriteria)
    .where(eq(evaluationCriteria.activityId, activity.id))
    .orderBy(evaluationCriteria.position)
    .all();

  const subs = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.activityId, activity.id), eq(submissions.userId, userId)))
    .orderBy(desc(submissions.createdAt))
    .all();

  const reviews = await db
    .select()
    .from(aiReviews)
    .where(and(eq(aiReviews.activityId, activity.id), eq(aiReviews.userId, userId)))
    .orderBy(desc(aiReviews.createdAt))
    .all();

  const noticeDocCount = (await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.activityId, activity.id), eq(documents.category, "notice")))
    .all()).length;

  const selectedReview =
    (selectedReviewId ? reviews.find((r) => r.id === selectedReviewId) : null) ??
    reviews.find((r) => r.status === "done") ??
    null;
  const selectedResult = selectedReview
    ? parseReviewResult(selectedReview.action, selectedReview.resultJson)
    : null;

  const provider = getProviderName();
  const subNameById = new Map(subs.map((s) => [s.id, s.title]));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* 왼쪽: 액션 + 기준 + 히스토리 */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> AI Actions
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              provider:{" "}
              <Badge variant={provider === "claude" ? "default" : "secondary"}>{provider}</Badge>
              {provider === "mock" && " (개발용 휴리스틱 분석)"}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <RunAIButton
              activityId={activity.id}
              action="analyze_announcement"
              label="공고문 분석"
              className="w-full [&>button]:w-full [&>button]:justify-start"
            />
            <RunAIButton
              activityId={activity.id}
              action="extract_criteria"
              label="평가 기준 추출"
              className="w-full [&>button]:w-full [&>button]:justify-start"
            />
            <RunAIButton
              activityId={activity.id}
              action="fit_analysis"
              label="내 적합도 분석"
              className="w-full [&>button]:w-full [&>button]:justify-start"
            />
            <RunAIButton
              activityId={activity.id}
              action="expected_questions"
              label="예상 질문 생성"
              className="w-full [&>button]:w-full [&>button]:justify-start"
            />
            {noticeDocCount === 0 && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                공고문 분석을 위해{" "}
                <Link
                  href={`/activities/${activity.id}?tab=documents`}
                  className="text-primary hover:underline"
                >
                  문서 탭
                </Link>
                에서 &lsquo;공고 / 안내&rsquo; 파일을 업로드하세요.
              </p>
            )}
          </CardContent>
        </Card>

        {subs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>제출물 대상 액션</CardTitle>
              <p className="text-xs text-muted-foreground">
                평가·최종 검토는 제출물 탭에서도 실행할 수 있습니다.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {subs.map((submission) => (
                <div key={submission.id} className="rounded-md border p-2.5">
                  <p className="mb-2 truncate text-xs font-semibold">{submission.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <RunAIButton
                      activityId={activity.id}
                      action="evaluate_submission"
                      submissionId={submission.id}
                      label="평가"
                      variant="secondary"
                    />
                    <RunAIButton
                      activityId={activity.id}
                      action="proofread"
                      submissionId={submission.id}
                      label="첨삭"
                    />
                    <RunAIButton
                      activityId={activity.id}
                      action="improvements"
                      submissionId={submission.id}
                      label="개선점"
                    />
                    <RunAIButton
                      activityId={activity.id}
                      action="final_check"
                      submissionId={submission.id}
                      label="최종 검토"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-muted-foreground" /> 평가 기준
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CriteriaManager activityId={activity.id} criteria={criteria} />
          </CardContent>
        </Card>

        {reviews.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>리뷰 히스토리</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {reviews.slice(0, 15).map((review) => {
                  const pct =
                    review.overallScore != null && review.maxScore
                      ? Math.round((review.overallScore / review.maxScore) * 100)
                      : null;
                  const isActive = selectedReview?.id === review.id;
                  return (
                    <li key={review.id}>
                      <Link
                        href={`/activities/${activity.id}?tab=ai&review=${review.id}`}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                          isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {AI_ACTIONS[review.action as AIAction] ?? review.action}
                            {review.submissionId &&
                              subNameById.get(review.submissionId) &&
                              ` · ${subNameById.get(review.submissionId)}`}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDateTime(review.createdAt)}
                          </span>
                        </span>
                        {review.status === "error" ? (
                          <Badge variant="destructive">실패</Badge>
                        ) : review.status !== "done" ? (
                          <Badge variant="secondary">진행 중</Badge>
                        ) : pct !== null ? (
                          <Badge variant="secondary">{pct}점</Badge>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 오른쪽: 선택된 리뷰 결과 */}
      <div className="lg:col-span-2">
        {!selectedReview ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">아직 실행한 AI 분석이 없습니다</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                공고문을 업로드하고 &lsquo;공고문 분석&rsquo;으로 시작해보세요. 마감일과 평가 기준을
                자동으로 추출하고, 제출물을 그 기준으로 평가할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        ) : selectedReview.status === "error" ? (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-4 w-4" /> AI 실행 실패
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{selectedReview.errorMessage}</p>
            </CardContent>
          </Card>
        ) : selectedResult ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {AI_ACTIONS[selectedReview.action as AIAction] ?? selectedReview.action}
                {selectedReview.submissionId && subNameById.get(selectedReview.submissionId)
                  ? ` — ${subNameById.get(selectedReview.submissionId)}`
                  : ""}
              </h3>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(selectedReview.createdAt)}
              </span>
            </div>
            <ReviewResult
              review={selectedReview}
              result={selectedResult}
              activityId={activity.id}
            />
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              결과를 불러올 수 없습니다.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
