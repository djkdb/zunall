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
