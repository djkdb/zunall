"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical, Loader2 } from "lucide-react";
import { updateActivityStatus } from "@/actions/activities";
import { ACTIVITY_STATUSES, ACTIVITY_TYPES, type ActivityStatus, type ActivityType } from "@/lib/constants";
import { cn, ddayColorClass, ddayLabel } from "@/lib/utils";

export interface BoardItem {
  id: string;
  name: string;
  status: string;
  type: string;
  color: string;
  nearestDeadline: { days: number; label: string } | null;
}

/**
 * 지원 현황 보드.
 * 목록으로는 "어디까지 갔는지"가 안 보인다. 상태를 열로 놓고 끌어 옮긴다.
 */
const COLUMNS: ActivityStatus[] = [
  "interested",
  "planned",
  "applied",
  "active",
  "submitted",
  "waiting",
  "won",
];

export function StatusBoard({ items }: { items: BoardItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [moved, setMoved] = React.useState<Record<string, string>>({});
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  const statusOf = (item: BoardItem) => moved[item.id] ?? item.status;

  function move(id: string, status: ActivityStatus) {
    setMoved((prev) => ({ ...prev, [id]: status }));
    startTransition(async () => {
      await updateActivityStatus(id, status);
      router.refresh();
    });
  }

  // 보드에 없는 상태(탈락·종료)는 마지막 열에 모아 보여준다
  const closedCount = items.filter((i) => !COLUMNS.includes(statusOf(i) as ActivityStatus)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {pending && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> 저장 중
          </span>
        )}
      </div>

      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((column) => {
          const columnItems = items.filter((item) => statusOf(item) === column);
          return (
            <div
              key={column}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(column);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData("text/activity-id");
                if (id) move(id, column);
              }}
              className={cn(
                "flex w-60 shrink-0 flex-col rounded-lg border bg-secondary/40 p-2 transition-colors dark:bg-secondary/20",
                dragOver === column && "border-primary bg-accent",
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ACTIVITY_STATUSES[column]}
                </h3>
                <span className="rounded-full bg-secondary px-1.5 text-[10px] font-semibold text-muted-foreground">
                  {columnItems.length}
                </span>
              </div>

              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {columnItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/activity-id", item.id)}
                    className="group cursor-grab rounded-md border bg-card p-2.5 shadow-sm active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/activities/${item.id}`}
                          className="block text-sm font-medium leading-snug hover:text-primary hover:underline"
                        >
                          {item.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: item.color }}
                            aria-hidden
                          />
                          <span>{ACTIVITY_TYPES[item.type as ActivityType] ?? item.type}</span>
                          {item.nearestDeadline && (
                            <span className={cn("font-semibold", ddayColorClass(item.nearestDeadline.days))}>
                              {ddayLabel(item.nearestDeadline.days)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 드래그가 어려운 기기(모바일)를 위한 대체 수단 */}
                    <label className="mt-2 block">
                      <span className="sr-only">{item.name} 상태 바꾸기</span>
                      <select
                        value={statusOf(item)}
                        onChange={(e) => move(item.id, e.target.value as ActivityStatus)}
                        className="h-7 w-full rounded border border-input bg-background px-1 text-[11px] text-muted-foreground"
                      >
                        {(Object.keys(ACTIVITY_STATUSES) as ActivityStatus[]).map((key) => (
                          <option key={key} value={key}>
                            {ACTIVITY_STATUSES[key]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {closedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          탈락·종료한 활동 {closedCount}개는 보드에 표시하지 않습니다. 목록 보기에서 확인하세요.
        </p>
      )}
    </div>
  );
}
