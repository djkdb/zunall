"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, History, ChevronDown, Copy } from "lucide-react";
import { findSimilarAnswers, type SimilarAnswer } from "@/actions/essays";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";

/**
 * 같은 유형의 문항에 예전에 쓴 답변.
 * 자소서에서 시간을 가장 많이 잡아먹는 "그때 뭐라고 썼더라"를 없애는 것이 목적이다.
 * 통째로 붙여넣는 것이 아니라 참고해 고쳐 쓰도록 "가져오기"는 이어붙이기로 동작한다.
 */
export function SimilarAnswers({
  questionId,
  onInsert,
}: {
  questionId: string;
  onInsert: (text: string) => void;
}) {
  const [items, setItems] = React.useState<SimilarAnswer[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      setLoading(true);
      setItems(await findSimilarAnswers(questionId));
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border bg-secondary/30">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium hover:bg-secondary/60"
      >
        <History className="h-3.5 w-3.5 text-primary" />
        비슷한 문항에 쓴 답변
        {items !== null && <span className="text-muted-foreground">({items.length})</span>}
        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-2 border-t px-3 py-2">
          {loading && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> 찾는 중…
            </p>
          )}

          {!loading && items !== null && items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              같은 유형으로 저장해둔 답변이 아직 없습니다. 다른 지원서에 답변을 쓰면 여기에 모입니다.
            </p>
          )}

          {items?.map((item) => (
            <div key={item.questionId} className="rounded-md border bg-card p-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  href={`/activities/${item.activityId}?tab=essay`}
                  className="text-xs font-medium hover:text-primary hover:underline"
                >
                  {item.activityName}
                </Link>
                <span className="text-[11px] text-muted-foreground">
                  v{item.version} · {relativeTime(item.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{item.question}</p>

              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed">
                {expanded === item.questionId ? item.content : `${item.content.slice(0, 160)}${item.content.length > 160 ? "…" : ""}`}
              </p>

              <div className="mt-1.5 flex gap-1.5">
                {item.content.length > 160 && (
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => setExpanded(expanded === item.questionId ? null : item.questionId)}
                  >
                    {expanded === item.questionId ? "접기" : "전체 보기"}
                  </button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-6 px-2 text-[11px]"
                  onClick={() => onInsert(item.content)}
                >
                  <Copy className="h-3 w-3" /> 가져오기
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
