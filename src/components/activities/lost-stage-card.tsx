"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setLostStage } from "@/actions/activities";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LOST_STAGES } from "@/services/score/outcome";

/**
 * 탈락한 지원의 요약 탭 맨 위에 뜬다.
 * 단계를 한 번 눌러 두면, 탈락이 쌓였을 때 "어디서 막히는지"를 통계가 대신 말해 준다.
 */
export function LostStageCard({ activityId, stage }: { activityId: string; stage: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [current, setCurrent] = React.useState(stage);
  const [error, setError] = React.useState<string | null>(null);

  function pick(next: string) {
    const value = next === current ? "" : next;
    setError(null);
    startTransition(async () => {
      const result = await setLostStage(activityId, value);
      if (!result.ok) {
        setError(result.error ?? "저장하지 못했습니다.");
        return;
      }
      setCurrent(value || null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold">어디서 떨어졌나요?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            서류에서 막히는 것과 면접에서 막히는 것은 해야 할 일이 다릅니다. 하나만 눌러 두면 지원이 쌓였을 때
            어디서 막히는지 알려드립니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="탈락 단계">
          {Object.entries(LOST_STAGES).map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={pending}
              aria-pressed={current === key}
              onClick={() => pick(key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60",
                current === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          떨어진 이유를 짐작할 수 있다면{" "}
          <Link href={`/activities/${activityId}?tab=history`} className="text-primary hover:underline">
            기록 탭에서 돌아보기
          </Link>
          를 남겨 두세요. 다음 지원서에서 같은 실수를 줄여 줍니다.
        </p>
      </CardContent>
    </Card>
  );
}
