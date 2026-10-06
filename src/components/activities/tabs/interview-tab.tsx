import Link from "next/link";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { Mic, Play } from "lucide-react";
import { db, events, interviewQuestions, mockInterviews, type ActivityRow } from "@/lib/db";
import { InterviewPrep } from "@/components/interview/interview-prep";
import { buttonVariants } from "@/components/ui/button";
import { grade } from "@/services/mock-interview/labels-ko";
import { formatDate, todayStr } from "@/lib/utils";

/**
 * 면접 준비: 예상 질문 만들기 → 답변 스크립트 작성 → 준비 완료 체크
 * + 이 공고(자소서·공고문)로 모의 면접을 보고, 받은 질문을 준비 목록에 담는다.
 */
export async function InterviewTab({ activity, userId }: { activity: ActivityRow; userId: string }) {
  const [questions, upcoming, practices] = await Promise.all([
    db
      .select()
      .from(interviewQuestions)
      .where(and(eq(interviewQuestions.activityId, activity.id), eq(interviewQuestions.userId, userId)))
      .orderBy(asc(interviewQuestions.position), asc(interviewQuestions.createdAt)),
    db
      .select()
      .from(events)
      .where(
        and(
          eq(events.activityId, activity.id),
          eq(events.userId, userId),
          eq(events.type, "interview"),
          gte(events.date, todayStr()),
        ),
      )
      .orderBy(asc(events.date))
      .limit(1),
    db
      .select({ id: mockInterviews.id, status: mockInterviews.status, overallScore: mockInterviews.overallScore, createdAt: mockInterviews.createdAt })
      .from(mockInterviews)
      .where(and(eq(mockInterviews.activityId, activity.id), eq(mockInterviews.userId, userId)))
      .orderBy(desc(mockInterviews.createdAt))
      .limit(5),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Mic className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">이 공고로 모의 면접</p>
            <p className="text-xs text-muted-foreground">
              공고문과 이 활동에 쓴 자소서를 읽은 면접관 3명이 질문하고, 답을 듣고 꼬리질문으로 파고듭니다. 받은 질문은 아래 준비 목록에 담을 수 있습니다.
            </p>
          </div>
        </div>
        <Link href={`/interview/new?activity=${activity.id}`} className={buttonVariants({ size: "sm" })}>
          <Play /> 모의 면접 보기
        </Link>
      </div>

      {practices.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">이 공고로 본 모의 면접</p>
          <ul className="flex flex-wrap gap-2">
            {practices.map((p) => (
              <li key={p.id}>
                <Link href={`/interview/${p.id}`} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-accent/50">
                  {formatDate(new Date(p.createdAt).toISOString().slice(0, 10))}
                  {p.status === "completed" && p.overallScore !== null ? (
                    <b className="tabular-nums">
                      {p.overallScore}점 {grade(p.overallScore)}
                    </b>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300">이어서 하기</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <InterviewPrep
        activityId={activity.id}
        questions={questions.map((q) => ({
          id: q.id,
          question: q.question,
          why: q.why,
          hint: q.hint,
          answer: q.answer,
          ready: q.ready === 1,
          source: q.source,
        }))}
        interviewDate={upcoming[0]?.date ?? null}
      />
    </div>
  );
}
