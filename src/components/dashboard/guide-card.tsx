import Link from "next/link";
import { CircleCheck, Circle, ArrowRight, LifeBuoy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface GuideStatus {
  hasGoal: boolean;
  hasEvidence: boolean;
  hasActivity: boolean;
  hasReview: boolean;
  hasRetro: boolean;
}

/**
 * 대시보드의 시작 가이드 요약.
 * 처음 온 사람이 "무엇부터 하면 되는지" 한 줄로 알 수 있게 하고,
 * 5단계를 다 끝내면 저절로 사라진다.
 */
export function GuideCard({ status }: { status: GuideStatus }) {
  const steps = [
    { label: "목표 직무 정하기", done: status.hasGoal, href: "/career" },
    { label: "내 이력 넣기", done: status.hasEvidence, href: "/career" },
    { label: "공고로 활동 등록", done: status.hasActivity, href: "/activities/new" },
    { label: "AI로 지원 판단", done: status.hasReview, href: "/opportunities" },
    { label: "끝난 활동 회고", done: status.hasRetro, href: "/portfolio" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const next = steps.find((s) => !s.done)!;

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-accent/50 to-card">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <LifeBuoy className="h-4 w-4 text-primary" /> 시작 가이드 {doneCount}/{steps.length}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-1 text-xs">
                {step.done ? (
                  <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
                <span className={step.done ? "text-muted-foreground line-through" : ""}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/guide">
            <Button size="sm" variant="ghost">
              전체 보기
            </Button>
          </Link>
          <Link href={next.href}>
            <Button size="sm">
              {next.label} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
