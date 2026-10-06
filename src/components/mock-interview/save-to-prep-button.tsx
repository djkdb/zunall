"use client";

import * as React from "react";
import { BookmarkPlus, Check, Loader2 } from "lucide-react";
import { saveQuestionToPrep } from "@/actions/mock-interview";
import { Button } from "@/components/ui/button";

/** 이 질문과 내 답을 활동의 "면접 준비" 목록에 담는다 (실제 면접 전에 답변을 다듬도록) */
export function SaveToPrepButton({ interviewId, questionId }: { interviewId: string; questionId: string }) {
  const [state, setState] = React.useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);
  async function save() {
    setState("pending");
    setError(null);
    const result = await saveQuestionToPrep(interviewId, questionId);
    if (!result.ok) {
      setState("idle");
      return setError(result.error);
    }
    setState("done");
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={save} disabled={state !== "idle"}>
        {state === "pending" ? <Loader2 className="animate-spin" /> : state === "done" ? <Check /> : <BookmarkPlus />}
        {state === "done" ? "면접 준비에 담았습니다" : "면접 준비에 담기"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
