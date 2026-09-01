"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, tasks, activities } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logHistory, pushNotification } from "@/lib/history";
import { handleTaskCompletionForCareer } from "@/lib/career-queries";
import { newId } from "@/lib/utils";
import { taskSchema, type TaskInput } from "@/lib/validators";
import { TASK_STATUSES } from "@/lib/constants";
import type { ActionResult } from "@/actions/activities";

function revalidateTaskPaths(activityId: string | null) {
  revalidatePath("/");
  if (activityId) revalidatePath(`/activities/${activityId}`);
}

export async function createTask(input: TaskInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  if (data.activityId) {
    const act = db
      .select({ id: activities.id })
      .from(activities)
      .where(and(eq(activities.id, data.activityId), eq(activities.userId, user.id)))
      .get();
    if (!act) return { ok: false, error: "활동을 찾을 수 없습니다." };
  }

  const maxPos = db
    .select({ position: tasks.position })
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(desc(tasks.position))
    .get();

  const id = newId();
  const now = Date.now();
  db.insert(tasks)
    .values({
      id,
      userId: user.id,
      activityId: data.activityId,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      priority: data.priority,
      status: data.status,
      position: (maxPos?.position ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
      completedAt: data.status === "done" ? now : null,
    })
    .run();

  if (data.activityId) {
    logHistory(user.id, data.activityId, "task", `작업 추가: ${data.title}`);
  }
  revalidateTaskPaths(data.activityId);
  return { ok: true, id };
}

export async function updateTask(taskId: string, input: TaskInput): Promise<ActionResult> {
  const user = await requireUser();
  const existing = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
    .get();
  if (!existing) return { ok: false, error: "작업을 찾을 수 없습니다." };

  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  db.update(tasks)
    .set({
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      priority: data.priority,
      status: data.status,
      updatedAt: Date.now(),
      completedAt:
        data.status === "done" ? (existing.completedAt ?? Date.now()) : null,
    })
    .where(eq(tasks.id, taskId))
    .run();

  revalidateTaskPaths(existing.activityId);
  return { ok: true, id: taskId };
}

/** 칸반 이동 등 상태만 빠르게 변경 */
export async function updateTaskStatus(taskId: string, status: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(status in TASK_STATUSES)) return { ok: false, error: "잘못된 상태입니다." };

  const existing = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
    .get();
  if (!existing) return { ok: false, error: "작업을 찾을 수 없습니다." };

  db.update(tasks)
    .set({
      status,
      updatedAt: Date.now(),
      completedAt: status === "done" ? (existing.completedAt ?? Date.now()) : null,
    })
    .where(eq(tasks.id, taskId))
    .run();

  if (existing.activityId && status === "done" && existing.status !== "done") {
    logHistory(user.id, existing.activityId, "task", `작업 완료: ${existing.title}`);
  }

  // 커리어 미션/로드맵과 연결된 작업이면 완료 처리 + Career Score 갱신
  if (status === "done" && existing.status !== "done") {
    const missionDone = handleTaskCompletionForCareer(user.id, taskId);
    if (missionDone) {
      pushNotification({
        userId: user.id,
        type: "system",
        title: "커리어 미션 완료 🔥",
        body: `"${existing.title}" 완료 — Career Score가 갱신되었습니다. 프로필에 근거를 추가하면 점수에 반영됩니다.`,
      });
      revalidatePath("/career");
      revalidatePath("/career/gaps");
    }
  }

  revalidateTaskPaths(existing.activityId);
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
    .get();
  if (!existing) return { ok: false, error: "작업을 찾을 수 없습니다." };

  db.delete(tasks).where(eq(tasks.id, taskId)).run();
  revalidateTaskPaths(existing.activityId);
  return { ok: true };
}
