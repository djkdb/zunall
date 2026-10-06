"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Check, Loader2, MessageSquarePlus } from "lucide-react";
import { sendFeedback } from "@/actions/feedback";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const KINDS = [
  ["bug", "불편·오류"],
  ["idea", "바라는 기능"],
  ["praise", "좋았던 점"],
  ["other", "기타"],
] as const;

/** 앱 어디서든 의견 보내기. 지금 보고 있는 화면 경로를 함께 남긴다. */
export function FeedbackButton({ variant = "sidebar" }: { variant?: "sidebar" | "tile" }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<(typeof KINDS)[number][0]>("idea");
  const [message, setMessage] = React.useState("");
  const [wantsReply, setWantsReply] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function send() {
    setState("sending");
    setError(null);
    const result = await sendFeedback({ kind, message, page: pathname, wantsReply });
    if (!result.ok) {
      setState("idle");
      return setError(result.error);
    }
    setState("sent");
    setMessage("");
  }

  function close() {
    setOpen(false);
    setState("idle");
    setError(null);
  }

  return (
    <>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <MessageSquarePlus className="h-4 w-4" /> 의견 보내기
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs hover:bg-accent">
          <MessageSquarePlus className="h-5 w-5" />
          의견 보내기
        </button>
      )}
      <Dialog open={open} onClose={close} title="의견 보내기">
        {state === "sent" ? (
          <div className="space-y-3 py-2 text-center">
            <Check className="mx-auto h-8 w-8 text-emerald-600" />
            <p className="text-sm font-medium">보내 주셔서 고맙습니다.</p>
            <p className="text-xs text-muted-foreground">하나씩 읽고 다음 업데이트에 반영합니다.</p>
            <Button type="button" variant="outline" size="sm" onClick={close}>
              닫기
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div role="radiogroup" aria-label="의견 종류" className="flex flex-wrap gap-1.5">
              {KINDS.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cn("rounded-full border px-3 py-1 text-xs", kind === k ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-accent")}
                >
                  {label}
                </button>
              ))}
            </div>
            <label htmlFor="fb-message" className="sr-only">
              의견
            </label>
            <Textarea
              id="fb-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              placeholder={kind === "bug" ? "어느 화면에서 무엇을 했을 때 어떻게 됐는지 적어 주세요." : "자유롭게 적어 주세요. 한 줄도 좋습니다."}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={wantsReply} onChange={(e) => setWantsReply(e.target.checked)} />
              답장을 받을게요 (내 가입 이메일을 함께 보냅니다)
            </label>
            <p className="text-[11px] text-muted-foreground">지금 보고 있는 화면 주소({pathname})가 함께 전달됩니다. 자소서·답변 내용은 보내지 않습니다.</p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="button" onClick={send} disabled={state === "sending" || message.trim().length < 2}>
                {state === "sending" && <Loader2 className="animate-spin" />} 보내기
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
