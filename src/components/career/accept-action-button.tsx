"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Loader2, Check } from "lucide-react";
import { acceptMission } from "@/actions/career";
import { Button } from "@/components/ui/button";

/** Gap 추천 행동을 Task로 등록하는 버튼 (범용) */
export function AcceptActionButton({
  skill,
  title,
  reason,
  effect,
  minutes,
}: {
  skill: string;
  title: string;
  reason: string;
  effect: number;
  minutes: number;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "pending" | "done" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

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
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        disabled={state === "pending"}
        onClick={async () => {
          setState("pending");
          const result = await acceptMission({
            skill,
            title,
            reason,
            expectedEffect: effect,
            expectedMinutes: minutes,
          });
          if (!result.ok) {
            setState("error");
            setError(result.error);
            return;
          }
          setState("done");
          router.refresh();
        }}
      >
        {state === "pending" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ListPlus className="h-3 w-3" />
        )}
        Task로 등록
      </Button>
      {error && <span className="mt-0.5 text-[10px] text-destructive">{error}</span>}
    </span>
  );
}
