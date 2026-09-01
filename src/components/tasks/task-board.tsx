"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Sparkles, GripVertical } from "lucide-react";
import { updateTaskStatus, deleteTask } from "@/actions/tasks";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import {
  TASK_STATUSES,
  PRIORITY_BADGE_CLASSES,
  TASK_PRIORITIES,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/constants";
import { cn, daysUntil, ddayColorClass, ddayLabel } from "@/lib/utils";
import type { TaskRow } from "@/lib/db";

const COLUMN_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "done"];

/** 칸반 보드. HTML5 drag & drop + 셀렉트 폴백을 지원한다. */
export function TaskBoard({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [dragOver, setDragOver] = React.useState<TaskStatus | null>(null);
  // 낙관적 UI: 이동 직후 서버 반영 전까지 로컬 상태 유지
  const [optimistic, setOptimistic] = React.useState<Record<string, TaskStatus>>({});

  const statusOf = (task: TaskRow): TaskStatus =>
    optimistic[task.id] ?? (task.status as TaskStatus);

  function moveTask(taskId: string, status: TaskStatus) {
    setOptimistic((prev) => ({ ...prev, [taskId]: status }));
    startTransition(async () => {
      await updateTaskStatus(taskId, status);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMN_ORDER.map((column) => {
        const columnTasks = tasks.filter((t) => statusOf(t) === column);
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
              const taskId = e.dataTransfer.getData("text/task-id");
              if (taskId) moveTask(taskId, column);
            }}
            className={cn(
              "flex min-h-40 flex-col rounded-lg border bg-secondary/40 p-2 transition-colors dark:bg-secondary/20",
              dragOver === column && "border-primary bg-accent",
            )}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {TASK_STATUSES[column]}
              </h3>
              <span className="rounded-full bg-secondary px-1.5 text-[10px] font-semibold text-muted-foreground">
                {columnTasks.length}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              {columnTasks.map((task) => {
                const days = daysUntil(task.dueDate);
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)}
                    className="group cursor-grab rounded-md border bg-card p-2.5 shadow-sm active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-medium leading-snug",
                            column === "done" && "text-muted-foreground line-through",
                          )}
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {task.sourceReviewId && (
                            <span className="flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                              <Sparkles className="h-2.5 w-2.5" /> AI
                            </span>
                          )}
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              PRIORITY_BADGE_CLASSES[task.priority as TaskPriority],
                            )}
                          >
                            {TASK_PRIORITIES[task.priority as TaskPriority]}
                          </span>
                          {days !== null && (
                            <span className={cn("text-[10px] font-semibold", ddayColorClass(days))}>
                              {ddayLabel(days)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                        <TaskFormDialog task={task} triggerVariant="icon" />
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm("이 작업을 삭제할까요?")) return;
                            startTransition(async () => {
                              await deleteTask(task.id);
                              router.refresh();
                            });
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="작업 삭제"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* 모바일 등 DnD가 어려운 환경용 이동 셀렉트 */}
                    <select
                      value={column}
                      onChange={(e) => moveTask(task.id, e.target.value as TaskStatus)}
                      className="mt-2 w-full rounded border border-input bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground md:hidden"
                      aria-label="작업 상태 이동"
                    >
                      {COLUMN_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUSES[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
