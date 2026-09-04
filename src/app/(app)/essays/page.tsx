import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { PenLine, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db, activities, essayQuestions, essayDrafts } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TopicFilter } from "@/components/essays/topic-filter";
import { ESSAY_TOPICS, topicOf, type EssayTopic } from "@/services/essay/topics";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "자소서 문항 은행" };

/**
 * 지금까지 쓴 자소서 문항과 답변을 유형별로 모아 보는 화면.
 * 새 지원서를 쓸 때 "예전에 뭐라고 썼더라"를 여기서 바로 찾는다.
 */
export default async function EssaysPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const user = await requireUser();
  const { topic: rawTopic } = await searchParams;

  const [questions, drafts, acts] = await Promise.all([
    db
      .select()
      .from(essayQuestions)
      .where(eq(essayQuestions.userId, user.id))
      .orderBy(desc(essayQuestions.createdAt)),
    db
      .select()
      .from(essayDrafts)
      .where(eq(essayDrafts.userId, user.id))
      .orderBy(desc(essayDrafts.version)),
    db
      .select({ id: activities.id, name: activities.name })
      .from(activities)
      .where(eq(activities.userId, user.id)),
  ]);

  const activityName = new Map(acts.map((a) => [a.id, a.name]));

  // 문항마다 최신 답변 하나 (버전 내림차순이라 처음 만난 것이 최신)
  const latest = new Map<string, (typeof drafts)[number]>();
  for (const draft of drafts) {
    if (!latest.has(draft.questionId)) latest.set(draft.questionId, draft);
  }

  const counts = new Map<EssayTopic, number>();
  for (const question of questions) {
    const key = topicOf(question);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const selected = rawTopic && rawTopic in ESSAY_TOPICS ? (rawTopic as EssayTopic) : null;
  const shown = selected ? questions.filter((q) => topicOf(q) === selected) : questions;
  const answered = questions.filter((q) => latest.has(q.id)).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">자소서 문항 은행</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          지금까지 쓴 문항 {questions.length}개 · 답변을 저장한 문항 {answered}개. 새 지원서를 쓸 때
          같은 유형의 답변을 그대로 참고하세요.
        </p>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          icon={PenLine}
          title="아직 등록한 문항이 없습니다"
          description="활동 상세의 자소서 탭에서 문항을 등록하면 여기에 유형별로 모입니다."
        />
      ) : (
        <>
          <TopicFilter counts={Object.fromEntries(counts)} selected={selected} />

          <ul className="space-y-2">
            {shown.map((question) => {
              const draft = latest.get(question.id);
              const key = topicOf(question);
              return (
                <li key={question.id}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {ESSAY_TOPICS[key]}
                        </span>
                        <Link
                          href={`/activities/${question.activityId}?tab=essay`}
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {activityName.get(question.activityId) ?? "삭제된 활동"}
                        </Link>
                        {question.charLimit && (
                          <span className="text-xs text-muted-foreground">· 제한 {question.charLimit}자</span>
                        )}
                      </div>

                      <p className="mt-1.5 text-sm font-medium leading-relaxed">{question.question}</p>

                      {draft ? (
                        <>
                          <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                            {draft.content}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            v{draft.version} · {relativeTime(draft.createdAt)}
                            {draft.score !== null && ` · ${Math.round(draft.score)}점`}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1.5 text-sm text-muted-foreground">아직 답변을 저장하지 않았습니다.</p>
                      )}

                      <Link
                        href={`/activities/${question.activityId}?tab=essay`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        이어서 작성 <ArrowRight className="h-3 w-3" />
                      </Link>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
