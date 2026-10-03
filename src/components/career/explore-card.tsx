"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Compass, Loader2 } from "lucide-react";
import { chooseRole } from "@/actions/career";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExploreCandidate } from "@/services/career/explore";

/**
 * 진로를 아직 정하지 못한 사람에게 점수 대신 보여주는 카드.
 * 후보 직무를 나란히 놓고, 각각 무엇을 보는 직무인지와 작게 먼저 해 볼 일을 준다.
 */
export function ExploreCard({
  goalName,
  candidates,
  className,
}: {
  goalName: string;
  candidates: ExploreCandidate[];
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function choose(key: string) {
    setPending(key);
    setError(null);
    const result = await chooseRole(key);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5">
          <Compass className="h-4 w-4 text-muted-foreground" /> 진로 탐색 중
        </CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">
          &ldquo;{goalName}&rdquo; — 아직 정하는 중이라면 점수부터 매기지 않겠습니다. 후보를 나란히 놓고, 하나씩 작게
          먼저 해 보세요. 마음이 가는 쪽을 고르면 그때부터 준비도와 부족한 부분을 계산합니다.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
          {candidates.map((c) => (
            <li key={c.key} className="flex flex-col rounded-lg border p-3">
              <p className="text-sm font-semibold">{c.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">주로 보는 것: {c.keySkills.join(" · ")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c.overlap.length > 0 ? (
                  <>
                    이미 근거가 있는 것: <b className="text-foreground/80">{c.overlap.join(" · ")}</b>
                  </>
                ) : (
                  "아직 겹치는 근거는 없습니다"
                )}
              </p>
              <p className="mt-2 text-xs leading-relaxed">
                <b>먼저 해 볼 일</b> · 약 {Math.round((c.experiment.minutes / 60) * 10) / 10}시간
                <br />
                {c.experiment.title}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 h-7 self-start px-2 text-xs"
                disabled={pending !== null}
                onClick={() => choose(c.key)}
              >
                {pending === c.key && <Loader2 className="h-3.5 w-3.5 animate-spin" />}이 직무로 정하기
              </Button>
            </li>
          ))}
        </ul>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
