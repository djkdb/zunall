"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flame, Loader2, Check, X, ArrowRight } from "lucide-react";
import { acceptMission, dismissMission } from "@/actions/career";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MissionCandidate } from "@/services/career/mission";

/** 🔥 Today's Career Mission — 수락하면 Task가 생성된다 */
export function MissionCard({
  mission,
  activeTask,
}: {
  mission: MissionCandidate | null;
  /** 이미 진행 중인 미션 (career_actions accepted) */
  activeTask: { title: string; taskId: string | null } | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"accept" | "dismiss" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const hours = mission ? Math.round((mission.expectedMinutes / 60) * 10) / 10 : 0;

  async function handle(kind: "accept" | "dismiss") {
    if (!mission) return;
    setPending(kind);
    setError(null);
    const fn = kind === "accept" ? acceptMission : dismissMission;
    const result = await fn({
      skill: mission.skill,
      title: mission.title,
      reason: mission.reason,
      expectedEffect: mission.expectedEffect,
      expectedMinutes: mission.expectedMinutes,
    });
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-accent/60 to-card">
      <CardContent className="p-5">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
          <Flame className="h-4 w-4" /> Today&apos;s Career Mission
        </p>

        {activeTask ? (
          <div className="mt-2">
            <p className="text-base font-semibold leading-snug">{activeTask.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              진행 중인 미션이 있습니다. 작업을 완료하면 Career Score가 갱신됩니다.
            </p>
            <Link href="/?focus=tasks" className="mt-3 inline-block">
              <Button size="sm" variant="secondary">
                할 일에서 확인 <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        ) : !mission ? (
          <p className="mt-2 text-sm text-muted-foreground">
            추천할 미션이 없습니다. 목표를 설정하면 오늘 가장 효과적인 행동을 추천해드립니다.
          </p>
        ) : (
          <div className="mt-2">
            <p className="text-base font-semibold leading-snug">{mission.title}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                예상 효과 <b className="text-emerald-600 dark:text-emerald-400">+{mission.expectedEffect} Career Score</b>
              </span>
              <span>예상 소요 {hours}시간</span>
              <span>관련 역량: {mission.skill}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              <b className="text-foreground/80">이 행동을 추천한 이유</b> — {mission.why}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" disabled={pending !== null} onClick={() => handle("accept")}>
                {pending === "accept" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                이 미션 시작 (Task 생성)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending !== null}
                onClick={() => handle("dismiss")}
              >
                {pending === "dismiss" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                다른 추천 보기
              </Button>
            </div>
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
