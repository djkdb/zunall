import { and, eq } from "drizzle-orm";
import { ListTodo } from "lucide-react";
import { db, tasks, type ActivityRow } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";

export async function TasksTab({ activity, userId }: { activity: ActivityRow; userId: string }) {
  const activityTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.activityId, activity.id), eq(tasks.userId, userId)))
    .orderBy(tasks.position)
    .all();

  const done = activityTasks.filter((t) => t.status === "done").length;
  const progress =
    activityTasks.length > 0 ? Math.round((done / activityTasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <p className="shrink-0 text-sm text-muted-foreground">
            {done}/{activityTasks.length} 완료
          </p>
          <Progress value={progress} className="max-w-52" />
        </div>
        <TaskFormDialog activityId={activity.id} />
      </div>

      {activityTasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="등록된 작업이 없습니다"
          description="공고문 읽기, 기획서 작성, 결과물 검토 등 해야 할 일을 등록하고 칸반으로 관리하세요."
        />
      ) : (
        <TaskBoard tasks={activityTasks} />
      )}
    </div>
  );
}
