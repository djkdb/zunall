import { and, desc, eq, inArray } from "drizzle-orm";
import { PackageOpen, Sparkles, Crown } from "lucide-react";
import {
  db,
  submissions,
  submissionVersions,
  documents,
  aiReviews,
  type ActivityRow,
} from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmissionFormDialog } from "@/components/submissions/submission-form-dialog";
import { VersionUploadDialog } from "@/components/submissions/version-upload-dialog";
import { SubmissionStatusSelect } from "@/components/submissions/submission-status-select";
import { DeleteSubmissionButton } from "@/components/submissions/delete-submission-button";
import { DocumentActions } from "@/components/files/document-actions";
import { RunAIButton } from "@/components/ai/run-ai-button";
import { cn, daysUntil, ddayColorClass, ddayLabel, formatBytes, formatDate } from "@/lib/utils";

export async function SubmissionsTab({ activity, userId }: { activity: ActivityRow; userId: string }) {
  const subs = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.activityId, activity.id), eq(submissions.userId, userId)))
    .orderBy(desc(submissions.createdAt));

  const subIds = subs.map((s) => s.id);

  // 버전과 AI 평가는 서로 독립적이라 한 번에 보낸다.
  const [versions, reviews] = await Promise.all([
    subIds.length > 0
      ? db
          .select()
          .from(submissionVersions)
          .where(inArray(submissionVersions.submissionId, subIds))
          .orderBy(desc(submissionVersions.createdAt))
      : [],
    // 제출물별 최근 AI 평가 점수
    subIds.length > 0
      ? db
          .select()
          .from(aiReviews)
          .where(
            and(
              inArray(aiReviews.submissionId, subIds),
              eq(aiReviews.action, "evaluate_submission"),
              eq(aiReviews.status, "done"),
            ),
          )
          .orderBy(desc(aiReviews.createdAt))
      : [],
  ]);

  const docIds = versions.map((v) => v.documentId);
  const versionDocs =
    docIds.length > 0
      ? await db.select().from(documents).where(inArray(documents.id, docIds))
      : [];
  const docById = new Map(versionDocs.map((d) => [d.id, d]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          제출해야 할 결과물을 등록하고 버전과 AI 평가를 관리하세요.
        </p>
        <SubmissionFormDialog activityId={activity.id} />
      </div>

      {subs.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="등록된 제출물이 없습니다"
          description="기획서, 최종 결과물, 발표자료 등 제출해야 하는 결과물을 추가해보세요."
        />
      ) : (
        <div className="space-y-4">
          {subs.map((submission) => {
            const subVersions = versions.filter((v) => v.submissionId === submission.id);
            const latestReview = reviews.find((r) => r.submissionId === submission.id);
            const reviewScore =
              latestReview?.overallScore != null && latestReview.maxScore
                ? Math.round((latestReview.overallScore / latestReview.maxScore) * 100)
                : null;
            // 평가 점수 변화 추이 (오래된 순)
            const scoreHistory = reviews
              .filter((r) => r.submissionId === submission.id && r.overallScore != null && r.maxScore)
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((r) => Math.round((r.overallScore! / r.maxScore!) * 100));
            const days = daysUntil(submission.dueDate);
            const hasVersion = subVersions.length > 0;

            return (
              <Card key={submission.id}>
                <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{submission.title}</h3>
                      {reviewScore !== null && (
                        <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          <Sparkles className="h-3 w-3" /> AI {reviewScore}
                        </Badge>
                      )}
                      {days !== null && (
                        <span className={cn("text-xs font-semibold", ddayColorClass(days))}>
                          마감 {formatDate(submission.dueDate)} · {ddayLabel(days)}
                        </span>
                      )}
                    </div>
                    {submission.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{submission.description}</p>
                    )}
                    {scoreHistory.length > 1 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        점수 변화:{" "}
                        {scoreHistory.map((score, i) => (
                          <span key={i}>
                            {i > 0 && <span className="mx-0.5 text-muted-foreground/60">→</span>}
                            <span
                              className={cn(
                                "font-semibold",
                                i === scoreHistory.length - 1 &&
                                  (score > scoreHistory[i - 1]
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : score < scoreHistory[i - 1]
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-foreground"),
                              )}
                            >
                              {score}
                            </span>
                          </span>
                        ))}
                        {scoreHistory[scoreHistory.length - 1] > scoreHistory[0] && (
                          <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                            (+{scoreHistory[scoreHistory.length - 1] - scoreHistory[0]})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <SubmissionStatusSelect
                      submissionId={submission.id}
                      status={submission.status}
                    />
                    <SubmissionFormDialog
                      activityId={activity.id}
                      submission={submission}
                      triggerVariant="icon"
                    />
                    <DeleteSubmissionButton submissionId={submission.id} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 버전 목록 */}
                  {subVersions.length === 0 ? (
                    <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      아직 업로드된 버전이 없습니다. 파일을 올리면 v1부터 버전이 관리됩니다.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {subVersions.map((version) => {
                        const doc = docById.get(version.documentId);
                        return (
                          <li key={version.id} className="flex items-center gap-3 px-3 py-2">
                            <Badge
                              variant={version.isFinal ? "default" : "secondary"}
                              className={
                                version.isFinal
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : ""
                              }
                            >
                              {version.isFinal && <Crown className="h-3 w-3" />}
                              {version.versionLabel}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {doc?.originalName ?? "(파일 없음)"}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {doc ? formatBytes(doc.size) : ""}
                                {version.note ? ` · ${version.note}` : ""}
                              </p>
                            </div>
                            {doc && <DocumentActions documentId={doc.id} />}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* 액션 */}
                  <div className="flex flex-wrap items-center gap-2">
                    <VersionUploadDialog submissionId={submission.id} />
                    <VersionUploadDialog submissionId={submission.id} final />
                    {hasVersion && (
                      <>
                        <RunAIButton
                          activityId={activity.id}
                          action="evaluate_submission"
                          submissionId={submission.id}
                          label="AI 평가하기"
                          variant="secondary"
                        />
                        <RunAIButton
                          activityId={activity.id}
                          action="final_check"
                          submissionId={submission.id}
                          label="제출 전 최종 검토"
                        />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
