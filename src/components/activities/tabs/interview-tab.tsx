import { and, asc, eq, gte } from "drizzle-orm";
import { db, events, interviewQuestions, type ActivityRow } from "@/lib/db";
import { InterviewPrep } from "@/components/interview/interview-prep";
import { todayStr } from "@/lib/utils";

/** 면접 준비: 예상 질문 만들기 → 답변 스크립트 작성 → 준비 완료 체크 */
export async function InterviewTab({ activity, userId }: { activity: ActivityRow; userId: string }) {
  const [questions, upcoming] = await Promise.all([
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
          eq(events.type, "interview"),
          gte(events.date, todayStr()),
        ),
      )
      .orderBy(asc(events.date))
      .limit(1),
  ]);

  return (
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
  );
}
