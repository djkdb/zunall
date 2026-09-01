"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Check, Loader2 } from "lucide-react";
import { createTaskFromAI } from "@/actions/ai";
import { Button } from "@/components/ui/button";

/** AI 피드백 한 줄을 작업(Task)으로 등록하는 버튼 */
export function CreateTaskButton({
  activityId,
  reviewId,
  title,
}: {
  activityId: string;
  reviewId: string;
  title: string;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "pending" | "done" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick() {
    setState("pending");
    const result = await createTaskFromAI(activityId, title, reviewId);
    if (!result.ok) {
      setState("error");
      setError(result.error);
      return;
    }
    setState("done");
    router.refresh();
  }

  if (state === "done") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" /> 작업 등록됨
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-primary"
        disabled={state === "pending"}
        onClick={handleClick}
      >
        {state === "pending" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ListPlus className="h-3 w-3" />
        )}
        작업 만들기
      </Button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </span>
  );
}
