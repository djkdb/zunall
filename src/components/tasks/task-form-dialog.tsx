"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil } from "lucide-react";
import { createTask, updateTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { TaskRow } from "@/lib/db";

export function TaskFormDialog({
  activityId,
  task,
  triggerVariant = "button",
}: {
  activityId?: string | null;
  task?: TaskRow;
  triggerVariant?: "button" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isEdit = !!task;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const input = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      dueDate: String(form.get("dueDate") ?? ""),
      priority: String(form.get("priority") ?? "medium"),
      status: String(form.get("status") ?? "todo"),
      activityId: task?.activityId ?? activityId ?? undefined,
    };
    const result = isEdit ? await updateTask(task.id, input) : await createTask(input);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {triggerVariant === "button" ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> 작업 추가
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="작업 수정"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={isEdit ? "작업 수정" : "작업 추가"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">제목 *</Label>
            <Input
              id="task-title"
              name="title"
              required
              maxLength={200}
              defaultValue={task?.title ?? ""}
              placeholder="예: 기획서 작성"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">마감일</Label>
              <Input id="task-due" name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">우선순위</Label>
              <Select id="task-priority" name="priority" defaultValue={task?.priority ?? "medium"}>
                {Object.entries(TASK_PRIORITIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-status">상태</Label>
              <Select id="task-status" name="status" defaultValue={task?.status ?? "todo"}>
                {Object.entries(TASK_STATUSES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">설명</Label>
            <Textarea id="task-desc" name="description" rows={3} defaultValue={task?.description ?? ""} />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "저장" : "추가"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
