"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  FileSearch,
  Target,
  UserCheck,
  MessageCircleQuestion,
  ShieldCheck,
  Wand2,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { runAI } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 아이콘 컴포넌트는 서버→클라이언트로 직렬화할 수 없으므로 action 키로 내부에서 결정한다.
const ACTION_ICONS: Record<string, LucideIcon> = {
  analyze_announcement: FileSearch,
  extract_criteria: Target,
  fit_analysis: UserCheck,
  expected_questions: MessageCircleQuestion,
  final_check: ShieldCheck,
  proofread: Wand2,
  improvements: ListChecks,
  evaluate_submission: Sparkles,
};

/**
 * AI 액션 실행 버튼. 실행 완료 시 AI 탭의 해당 리뷰로 이동한다.
 */
export function RunAIButton({
  activityId,
  action,
  submissionId,
  label,
  variant = "outline",
  size = "sm",
  className,
}: {
  activityId: string;
  action: string;
  submissionId?: string | null;
  label: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const result = await runAI(activityId, action, submissionId ?? null);
      if (!result.ok) {
        setError(result.error ?? "AI 실행에 실패했습니다.");
        return;
      }
      router.push(`/activities/${activityId}?tab=ai&review=${result.reviewId}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const ButtonIcon = ACTION_ICONS[action] ?? Sparkles;

  return (
    <div className={cn("flex flex-col", className)}>
      <Button variant={variant} size={size} onClick={handleClick} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ButtonIcon className="h-4 w-4" />}
        {pending ? "AI 분석 중…" : label}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
