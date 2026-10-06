"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine } from "lucide-react";
import { reanswerMockInterview } from "@/actions/mock-interview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** 피드백을 보고 같은 질문에 다시 답해 본다. 원래 점수는 그대로 두고 새 점수를 옆에 남긴다. */
export function ReanswerBox({ interviewId, questionId }: { interviewId: string; questionId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilLine /> 다시 답해 보기
      </Button>
    );
  }

  async function submit() {
    setPending(true);
    setError(null);
    const result = await reanswerMockInterview(interviewId, { questionId, answer: text });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    setText("");
    router.refresh();
  }

  return (
    <div className="w-full space-y-2">
      <label htmlFor={`re-${questionId}`} className="sr-only">
        다시 쓴 답변
      </label>
      <Textarea id={`re-${questionId}`} value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} rows={4} placeholder="피드백을 반영해 다시 답해 보세요." disabled={pending} />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={pending || !text.trim()}>
          {pending && <Loader2 className="animate-spin" />} 다시 채점받기
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          취소
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}
