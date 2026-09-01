"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2 } from "lucide-react";
import { analyzeOpportunityFit } from "@/actions/opportunity";
import { Button } from "@/components/ui/button";

/** 공고 요구 역량 AI 추출 + 규칙 기반 적합도 계산 실행 버튼 */
export function AnalyzeFitButton({
  activityId,
  rerun,
  size = "sm",
}: {
  activityId: string;
  rerun?: boolean;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <span className="inline-flex flex-col">
      <Button
        size={size}
        variant={rerun ? "outline" : "default"}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await analyzeOpportunityFit(activityId);
          setPending(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/activities/${activityId}?tab=fit`);
          router.refresh();
        }}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        {pending ? "분석 중…" : rerun ? "적합도 다시 분석" : "지원 적합도 분석"}
      </Button>
      {error && <span className="mt-1 text-xs text-destructive">{error}</span>}
    </span>
  );
}
