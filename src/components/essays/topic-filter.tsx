"use client";

import Link from "next/link";
import { ESSAY_TOPICS, type EssayTopic } from "@/services/essay/topics";
import { cn } from "@/lib/utils";

/** 유형별로 좁혀 보는 칩 줄 (문항이 하나도 없는 유형은 감춘다) */
export function TopicFilter({
  counts,
  selected,
}: {
  counts: Partial<Record<EssayTopic, number>>;
  selected: EssayTopic | null;
}) {
  const keys = (Object.keys(ESSAY_TOPICS) as EssayTopic[]).filter((key) => (counts[key] ?? 0) > 0);
  const total = keys.reduce((sum, key) => sum + (counts[key] ?? 0), 0);

  return (
    <nav className="flex flex-wrap gap-1.5">
      <Chip href="/essays" on={selected === null}>
        전체 {total}
      </Chip>
      {keys.map((key) => (
        <Chip key={key} href={`/essays?topic=${key}`} on={selected === key}>
          {ESSAY_TOPICS[key]} {counts[key]}
        </Chip>
      ))}
    </nav>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        on
          ? "border-primary bg-primary/10 text-primary"
          : "border-input text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
