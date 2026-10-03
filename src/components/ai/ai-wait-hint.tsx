"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * AI 가 일하는 동안 버튼 옆에 띄우는 안내.
 * 실제 모델은 10~40초가 걸린다 (페르소나 시뮬레이션 실측 7~37초). 스피너만 돌면
 * 멈춘 줄 알고 새로고침하거나 버튼을 다시 누른다. 몇 초째인지와 보통 걸리는 시간을 보여준다.
 */
export function AIWaitHint({ active, className }: { active: boolean; className?: string }) {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active]);

  // 금방 끝나는 경우(간이 분석)에는 깜빡이지 않게 2초 뒤부터 보여준다
  if (!active || seconds < 2) return null;
  return (
    <p className={cn("mt-1 text-xs text-muted-foreground", className)}>
      <span role="status">AI가 읽고 쓰는 중입니다. 보통 10~40초 걸립니다.</span>{" "}
      <span aria-hidden="true">({seconds}초)</span>
    </p>
  );
}
