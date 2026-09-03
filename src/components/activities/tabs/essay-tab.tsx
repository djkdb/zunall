import { and, asc, desc, eq } from "drizzle-orm";
import { PenLine } from "lucide-react";
import { db, essayQuestions, essayDrafts, type ActivityRow } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { EssayQuestionForm } from "@/components/essays/essay-question-form";
import { EssayEditor } from "@/components/essays/essay-editor";

/** 자기소개서 문항별 작성 + AI 첨삭 */
export async function EssayTab({ activity, userId }: { activity: ActivityRow; userId: string }) {
  const [questions, drafts] = await Promise.all([
    db
      .select()
      .from(essayQuestions)
      .where(and(eq(essayQuestions.activityId, activity.id), eq(essayQuestions.userId, userId)))
      .orderBy(asc(essayQuestions.position)),
    db
      .select()
      .from(essayDrafts)
      .where(eq(essayDrafts.userId, userId))
      .orderBy(desc(essayDrafts.version)),
  ]);

  const draftsByQuestion = new Map<string, typeof drafts>();
  for (const draft of drafts) {
    const list = draftsByQuestion.get(draft.questionId) ?? [];
    list.push(draft);
    draftsByQuestion.set(draft.questionId, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          지원서 문항을 하나씩 등록하고, 답변마다 AI 첨삭을 받아 버전을 쌓아갑니다.
        </p>
        <EssayQuestionForm activityId={activity.id} />
      </div>

      {questions.length === 0 ? (
        <EmptyState
          icon={PenLine}
          title="등록된 문항이 없습니다"
          description="공고의 자기소개서 문항을 그대로 옮겨 적으면, 문항이 요구하는 것에 답했는지까지 봐줍니다."
        />
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <EssayEditor
              key={question.id}
              question={question}
              drafts={draftsByQuestion.get(question.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
