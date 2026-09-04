"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Plus, Trash2, Check, MessageCircleQuestion, CalendarClock } from "lucide-react";
import {
  generateInterviewQuestions,
  addInterviewQuestion,
  saveInterviewAnswer,
  toggleInterviewReady,
  deleteInterviewQuestion,
} from "@/actions/interview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, daysUntil, ddayLabel, formatDate } from "@/lib/utils";

interface Question {
  id: string;
  question: string;
  why: string | null;
  hint: string | null;
  answer: string | null;
  ready: boolean;
  source: string;
}

export function InterviewPrep({
  activityId,
  questions,
  interviewDate,
}: {
  activityId: string;
  questions: Question[];
  interviewDate: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState("");

  const ready = questions.filter((q) => q.ready).length;
  const days = daysUntil(interviewDate);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(key);
    setError(null);
    const result = await fn();
    setPending(null);
    if (!result.ok) return setError(result.error ?? "처리하지 못했습니다.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            내가 쓴 자기소개서와 공고를 근거로 질문을 만듭니다. 답변은 여기에 적어두고 면접 직전에
            훑어보세요.
          </p>
          {interviewDate && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-primary">
              <CalendarClock className="h-4 w-4" />
              면접 {formatDate(interviewDate)}
              {days !== null && days >= 0 && ` · ${ddayLabel(days)}`}
            </p>
          )}
        </div>
        <Button
          size="sm"
          disabled={pending !== null}
          onClick={() => run("generate", () => generateInterviewQuestions(activityId))}
        >
          {pending === "generate" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          예상 질문 만들기
        </Button>
      </div>

      {questions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          질문 {questions.length}개 · 준비 완료 {ready}개
        </p>
      )}

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!manual.trim()) return;
          await run("add", () => addInterviewQuestion({ activityId, question: manual }));
          setManual("");
        }}
      >
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="직접 질문 추가 (실제로 받은 질문을 적어두면 다음에 도움이 됩니다)"
          maxLength={500}
          aria-label="질문 직접 추가"
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending !== null || !manual.trim()}>
          {pending === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          추가
        </Button>
      </form>

      {questions.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title="아직 준비한 질문이 없습니다"
          description="자기소개서를 먼저 써두면 그 내용에서 파고드는 질문까지 만들어집니다."
        />
      ) : (
        <ul className="space-y-2">
          {questions.map((q, index) => (
            <QuestionCard
              key={q.id}
              index={index + 1}
              question={q}
              pending={pending}
              onToggle={() => run(`ready-${q.id}`, () => toggleInterviewReady(q.id))}
              onDelete={() => run(`del-${q.id}`, () => deleteInterviewQuestion(q.id))}
              onSave={(answer) => run(`save-${q.id}`, () => saveInterviewAnswer(q.id, answer))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionCard({
  index,
  question,
  pending,
  onToggle,
  onDelete,
  onSave,
}: {
  index: number;
  question: Question;
  pending: string | null;
  onToggle: () => void;
  onDelete: () => void;
  onSave: (answer: string) => void;
}) {
  const [answer, setAnswer] = React.useState(question.answer ?? "");
  const [open, setOpen] = React.useState(!question.answer);
  const changed = answer !== (question.answer ?? "");

  return (
    <li className={cn("rounded-lg border bg-card p-3", question.ready && "border-emerald-500/40")}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={question.ready ? "준비 완료 해제" : "준비 완료로 표시"}
          onClick={onToggle}
          disabled={pending !== null}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
            question.ready
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-input text-transparent hover:border-primary",
          )}
        >
          <Check className="h-3 w-3" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-relaxed">
            <span className="mr-1.5 text-muted-foreground">{index}.</span>
            {question.question}
          </p>
          {question.why && <p className="mt-1 text-xs text-muted-foreground">왜 나오나: {question.why}</p>}
          {question.hint && (
            <p className="mt-0.5 text-xs text-primary">답변 포인트: {question.hint}</p>
          )}

          {!open && question.answer && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-1.5 block w-full whitespace-pre-wrap rounded-md bg-secondary/60 p-2 text-left text-xs leading-relaxed"
            >
              {question.answer}
            </button>
          )}

          {open && (
            <div className="mt-2 space-y-2">
              <Textarea
                rows={4}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="답변을 적어두세요. 상황 → 내 역할 → 행동 → 결과 순서가 기억하기 쉽습니다."
                aria-label={`${question.question} 답변`}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{answer.replace(/\s/g, "").length}자</span>
                <div className="ml-auto flex gap-1.5">
                  {question.answer && (
                    <Button size="sm" variant="ghost" onClick={() => { setAnswer(question.answer ?? ""); setOpen(false); }}>
                      접기
                    </Button>
                  )}
                  <Button size="sm" disabled={pending !== null || !changed} onClick={() => { onSave(answer); setOpen(false); }}>
                    {pending === `save-${question.id}` && <Loader2 className="h-4 w-4 animate-spin" />}
                    저장
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="질문 삭제"
          onClick={onDelete}
          disabled={pending !== null}
          className="rounded p-1 text-muted-foreground hover:text-destructive"
        >
          {pending === `del-${question.id}` ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </li>
  );
}
