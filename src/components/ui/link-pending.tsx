"use client";

import { useLinkStatus } from "next/link";

/**
 * <Link> 안에서만 쓰는 이동 표시.
 * 화면 전체를 스켈레톤으로 덮는 loading.tsx 는 Cloudflare(OpenNext) 스트리밍과
 * 충돌해 이동이 멈추는 문제가 있어, 누른 링크에만 작은 표시를 남긴다.
 */
export function LinkPendingDot({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className={`h-1.5 w-1.5 animate-pulse rounded-full bg-current ${className ?? ""}`}
      aria-hidden
    />
  );
}

/**
 * <Link> 안에 두면, 그 링크로 이동하는 동안 화면 맨 위에 얇은 진행 막대를 띄운다.
 * 서버 응답을 기다리는 동안 화면이 그대로라 "눌렸나?" 싶어 다시 누르게 되는 것을 막는다.
 * (0.1초 안에 끝나는 이동에서는 보이지 않게 애니메이션을 조금 늦게 시작한다)
 */
export function LinkPendingBar() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left animate-nav-progress bg-primary"
      role="progressbar"
      aria-label="화면을 불러오는 중"
    />
  );
}
