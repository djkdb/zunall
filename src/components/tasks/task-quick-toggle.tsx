"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/actions/tasks";
import { PRIORITY_BADGE_CLASSES, type TaskPriority } from "@/lib/constants";
import { cn, daysUntil, ddayColorClass, ddayLabel } from "@/lib/utils";
import type { TaskRow } from "@/lib/db";

/** 체크박스로 작업 완료 처리하는 한 줄 항목 (Overview/Dashboard 용) */
export function TaskQuickToggle({ task }: { task: TaskRow }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const days = daysUntil(task.dueDate);

  return (
    <li className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={task.status === "done"}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked ? "done" : "todo";
          startTransition(async () => {
            await updateTaskStatus(task.id, next);
            router.refresh();
          });
        }}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-[hsl(var(--primary))]"
        aria-label={`${task.title} 완료 처리`}
      />
      <span className={cn("min-w-0 flex-1 truncate", task.status === "done" && "text-muted-foreground line-through")}>
        {task.title}
      </span>
      {task.priority !== "medium" && (
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            PRIORITY_BADGE_CLASSES[task.priority as TaskPriority],
          )}
        >
          {task.priority === "urgent" ? "긴급" : task.priority === "high" ? "높음" : "낮음"}
        </span>
      )}
      {days !== null && (
        <span className={cn("shrink-0 text-xs font-medium", ddayColorClass(days))}>
          {ddayLabel(days)}
        </span>
      )}
    </li>
  );
}
