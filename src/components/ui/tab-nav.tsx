"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

/**
 * URL searchParam 기반 탭 내비게이션 (서버 렌더링과 함께 동작).
 * 링크는 `${hrefPrefix}${key}` 형태로 생성된다 (서버→클라이언트 직렬화 가능하도록 함수 대신 문자열 사용).
 */
export function TabNav({
  tabs,
  active,
  hrefPrefix,
  className,
}: {
  tabs: TabItem[];
  active: string;
  hrefPrefix: string;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "scrollbar-thin flex gap-1 overflow-x-auto border-b pb-px",
        className,
      )}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`${hrefPrefix}${tab.key}`}
          scroll={false}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            active === tab.key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="rounded-full bg-secondary px-1.5 text-[10px] font-semibold text-secondary-foreground">
              {tab.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
