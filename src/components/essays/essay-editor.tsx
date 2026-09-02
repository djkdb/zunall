"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Trash2, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { coachEssayDraft, deleteEssayQuestion, saveEssayDraft } from "@/actions/essays";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question: string;
  charLimit: number | null;
  guide: string | null;
}

interface Draft {
  id: string;
  version: number;
  content: string;
  feedbackJson: string | null;
  score: number | null;
  createdAt: number;
}

interface Feedback {
  score: number;
  summary: string;
  answersQuestion: boolean;
  strengths: string[];
  improvements: Array<{ point: string; why: string; suggestion: string }>;
  rewrites: Array<{ before: string; after: string }>;
}

/** 문항 하나: 답변 작성 → 저장(버전) → AI 첨삭 → 점수 변화 확인 */
export function EssayEditor({ question, drafts }: { question: Question; drafts: Draft[] }) {
  const router = useRouter();
  const latest = drafts[0];
  const [content, setContent] = React.useState(latest?.content ?? "");
  const [pending, setPending] = React.useState<"save" | "coach" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const chars = content.replace(/\s/g, "").length;
  const over = question.charLimit ? chars > question.charLimit : false;
  const feedback: Feedback | null = latest?.feedbackJson
    ? (JSON.parse(latest.feedbackJson) as Feedback)
    : null;
  const previousScore = drafts.find((d) => d.id !== latest?.id && d.score !== null)?.score ?? null;

  async function save() {
    setPending("save");
    setError(null);
    const result = await saveEssayDraft(question.id, content);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function saveAndCoach() {
    setPending("coach");
    setError(null);
    const saved = await saveEssayDraft(question.id, content);
    if (!saved.ok) {
      setPending(null);
      setError(saved.error);
      return;
    }
    const result = await coachEssayDraft(saved.id!);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-relaxed">{question.question}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {question.charLimit && <span>제한 {question.charLimit}자</span>}
              {question.guide && <span>· {question.guide}</span>}
              {drafts.length > 0 && <span>· v{latest.version}까지 저장됨</span>}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="문항 삭제"
            onClick={async () => {
              await deleteEssayQuestion(question.id);
              router.refresh();
            }}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <Textarea
          rows={9}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="답변을 작성하세요. 저장할 때마다 버전이 쌓이고, 점수 변화를 볼 수 있습니다."
          aria-label={`${question.question} 답변`}
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-xs", over ? "font-semibold text-destructive" : "text-muted-foreground")}>
            공백 제외 {chars}자{question.charLimit ? ` / ${question.charLimit}자` : ""}
            {over ? " (초과)" : ""}
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" disabled={pending !== null || !content.trim()} onClick={save}>
              {pending === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
              저장만
            </Button>
            <Button size="sm" disabled={pending !== null || !content.trim()} onClick={saveAndCoach}>
              {pending === "coach" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              저장하고 AI 첨삭
            </Button>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        {feedback && (
          <div className="space-y-3 rounded-lg border bg-secondary/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={feedback.score >= 80 ? "default" : "secondary"}>
                {feedback.score}점
              </Badge>
              {previousScore !== null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  이전 {previousScore}점 <ArrowRight className="h-3 w-3" />
                  <span
                    className={cn(
                      "font-semibold",
                      feedback.score >= previousScore ? "text-emerald-600" : "text-destructive",
                    )}
                  >
                    {feedback.score >= previousScore ? "+" : ""}
                    {Math.round(feedback.score - previousScore)}
                  </span>
                </span>
              )}
              {!feedback.answersQuestion && (
                <Badge variant="outline" className="text-destructive">
                  문항에 직접 답하지 않음
                </Badge>
              )}
            </div>

            <p className="text-sm">{feedback.summary}</p>

            {feedback.strengths.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">잘한 점</p>
                <ul className="space-y-1">
                  {feedback.strengths.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {feedback.improvements.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">고칠 점</p>
                <ul className="space-y-2">
                  {feedback.improvements.map((item, i) => (
                    <li key={i} className="rounded-md bg-background p-2 text-xs">
                      <p className="flex items-start gap-1.5 font-medium">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        {item.point}
                      </p>
                      {item.why && <p className="ml-5 mt-0.5 text-muted-foreground">{item.why}</p>}
                      {item.suggestion && (
                        <p className="ml-5 mt-1 text-foreground">→ {item.suggestion}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {feedback.rewrites.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">문장 고쳐쓰기</p>
                <ul className="space-y-2">
                  {feedback.rewrites.map((item, i) => (
                    <li key={i} className="rounded-md bg-background p-2 text-xs">
                      <p className="text-muted-foreground line-through">{item.before}</p>
                      <p className="mt-1">{item.after}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {drafts.length > 1 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              이전 버전 {drafts.length - 1}개 보기
            </summary>
            <ul className="mt-2 space-y-1">
              {drafts.slice(1).map((draft) => (
                <li key={draft.id} className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline">v{draft.version}</Badge>
                  {draft.score !== null && <span>{draft.score}점</span>}
                  <span className="truncate">{draft.content.slice(0, 60)}…</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
