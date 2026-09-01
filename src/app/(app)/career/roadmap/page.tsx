import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft, Map as MapIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db, roadmapItems } from "@/lib/db";
import { getCareerContext } from "@/lib/career-queries";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  GenerateRoadmapButton,
  AddRoadmapItemDialog,
  RoadmapItemControls,
} from "@/components/career/roadmap-controls";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Career Roadmap" };

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y} ${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][Number(m) - 1] ?? m}`;
}

export default async function RoadmapPage() {
  const user = await requireUser();
  const ctx = await getCareerContext(user.id);
  const items = await db
    .select()
    .from(roadmapItems)
    .where(eq(roadmapItems.userId, user.id))
    .orderBy(roadmapItems.month, roadmapItems.position)
    .all();

  const byMonth = new Map<string, typeof items>();
  for (const item of items) {
    const list = byMonth.get(item.month) ?? [];
    list.push(item);
    byMonth.set(item.month, list);
  }
  const months = Array.from(byMonth.keys()).sort();

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/career"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Career Profile
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Career Roadmap</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            목표 &ldquo;{ctx.goal?.name ?? "미설정"}&rdquo;을 향한 월 단위 계획. 각 항목은 Task로
            연결할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateRoadmapButton />
          <AddRoadmapItemDialog defaultMonth={defaultMonth} />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="로드맵이 비어 있습니다"
          description="'Gap 기반 자동 생성'을 누르면 Career Gap 분석에서 나온 추천 행동으로 3개월 계획을 만들어드립니다."
        />
      ) : (
        <ol className="relative space-y-6 border-l-2 border-border pl-6">
          {months.map((month) => (
            <li key={month} className="relative">
              <span className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
              <h2 className="text-sm font-bold uppercase tracking-wider">{monthLabel(month)}</h2>
              <ul className="mt-2 space-y-2">
                {byMonth.get(month)!.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 rounded-md border bg-card p-3",
                      item.status === "done" && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          item.status === "done" && "line-through",
                        )}
                      >
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    {item.status === "in_progress" && <Badge>진행 중</Badge>}
                    <RoadmapItemControls
                      itemId={item.id}
                      status={item.status}
                      hasTask={!!item.taskId}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
