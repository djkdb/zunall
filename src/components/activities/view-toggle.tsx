"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { List, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";

/** 목록 ↔ 보드 전환 (다른 필터는 그대로 유지한다) */
export function ViewToggle({ view }: { view: "list" | "board" }) {
  const params = useSearchParams();

  const href = (next: "list" | "board") => {
    const query = new URLSearchParams(params.toString());
    if (next === "board") query.set("view", "board");
    else query.delete("view");
    const text = query.toString();
    return `/activities${text ? `?${text}` : ""}`;
  };

  return (
    <nav className="flex gap-1 rounded-md border p-0.5" aria-label="보기 방식">
      <Tab href={href("list")} on={view === "list"}>
        <List className="h-3.5 w-3.5" /> 목록
      </Tab>
      <Tab href={href("board")} on={view === "board"}>
        <Columns3 className="h-3.5 w-3.5" /> 지원 현황 보드
      </Tab>
    </nav>
  );
}

function Tab({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
        on ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
