"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { applyAnnouncementResult } from "@/actions/ai";
import { Button } from "@/components/ui/button";

/**
 * AI 공고 분석 결과를 사용자가 확인하고 선택적으로 활동에 반영하는 패널.
 * AI가 자동 확정하지 않고, 반드시 이 패널의 확인을 거친다.
 */
export function ApplyAnnouncementPanel({
  reviewId,
  hasDates,
  criteriaCount,
}: {
  reviewId: string;
  hasDates: boolean;
  criteriaCount: number;
}) {
  const router = useRouter();
  const [applyDates, setApplyDates] = React.useState(hasDates);
  const [applyCriteria, setApplyCriteria] = React.useState(criteriaCount > 0);
  const [applySummary, setApplySummary] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleApply() {
    setPending(true);
    setMessage(null);
    const result = await applyAnnouncementResult(reviewId, {
      applyDates,
      applyCriteria,
      applySummary,
    });
    setPending(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage("활동에 반영되었습니다.");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-accent/40 p-4">
      <p className="text-sm font-medium">이 분석 결과를 활동에 반영할까요?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        AI 추출값은 자동으로 확정되지 않습니다. 내용을 확인한 뒤 반영할 항목을 선택하세요.
      </p>
      <div className="mt-3 flex flex-col gap-1.5 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={applyDates}
            disabled={!hasDates}
            onChange={(e) => setApplyDates(e.target.checked)}
            className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
          />
          주요 일정을 활동 마감일/캘린더에 등록 {!hasDates && "(추출된 날짜 없음)"}
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={applyCriteria}
            disabled={criteriaCount === 0}
            onChange={(e) => setApplyCriteria(e.target.checked)}
            className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
          />
          평가 기준 {criteriaCount}개 등록 {criteriaCount === 0 && "(추출된 기준 없음)"}
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={applySummary}
            onChange={(e) => setApplySummary(e.target.checked)}
            className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
          />
          AI 요약을 활동 Overview에 표시
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={handleApply} disabled={pending || (!applyDates && !applyCriteria && !applySummary)}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          선택 항목 반영
        </Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
