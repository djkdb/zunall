"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, activities, retrospectives, careerEvidence } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logHistory } from "@/lib/history";
import { newId } from "@/lib/utils";
import { normalizeSkillNames } from "@/services/career/skill-detect";
import type { ActionResult } from "@/actions/activities";

const retroSchema = z.object({
  activityId: z.string().min(1),
  situation: z.string().trim().max(2000).optional(),
  task: z.string().trim().max(2000).optional(),
  action: z.string().trim().max(4000).optional(),
  result: z.string().trim().max(2000).optional(),
  learned: z.string().trim().max(2000).optional(),
  skillsText: z.string().trim().max(300).optional(),
});

/**
 * 활동 회고 저장 (STAR).
 * 회고에 적은 스킬은 커리어 근거로도 등록해, 회고가 곧 스펙 근거가 되게 한다.
 */
export async function saveRetrospective(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = retroSchema.safeParse({
    activityId: formData.get("activityId"),
    situation: formData.get("situation") ?? "",
    task: formData.get("task") ?? "",
    action: formData.get("action") ?? "",
    result: formData.get("result") ?? "",
    learned: formData.get("learned") ?? "",
    skillsText: formData.get("skillsText") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const activity = (
    await db
      .select()
      .from(activities)
      .where(and(eq(activities.id, data.activityId), eq(activities.userId, user.id)))
      .limit(1)
  )[0];
  if (!activity) return { ok: false, error: "활동을 찾을 수 없습니다." };

  const skills = normalizeSkillNames(
    (data.skillsText ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const now = Date.now();

  const existing = (
    await db
      .select()
      .from(retrospectives)
      .where(eq(retrospectives.activityId, activity.id))
      .limit(1)
  )[0];

  if (existing) {
    await db
      .update(retrospectives)
      .set({
        situation: data.situation || null,
        task: data.task || null,
        action: data.action || null,
        result: data.result || null,
        learned: data.learned || null,
        skills: skills.length > 0 ? JSON.stringify(skills) : null,
        updatedAt: now,
      })
      .where(eq(retrospectives.id, existing.id));
  } else {
    await db.insert(retrospectives).values({
      id: newId(),
      userId: user.id,
      activityId: activity.id,
      situation: data.situation || null,
      task: data.task || null,
      action: data.action || null,
      result: data.result || null,
      learned: data.learned || null,
      skills: skills.length > 0 ? JSON.stringify(skills) : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 회고에 적은 스킬을 커리어 근거로 연결 (같은 활동은 한 번만)
  if (skills.length > 0) {
    const already = (
      await db
        .select({ id: careerEvidence.id })
        .from(careerEvidence)
        .where(
          and(
            eq(careerEvidence.userId, user.id),
            eq(careerEvidence.sourceType, "retrospective"),
            eq(careerEvidence.sourceId, activity.id),
          ),
        )
        .limit(1)
    )[0];

    const description = [data.result, data.learned].filter(Boolean).join(" / ").slice(0, 500);
    if (already) {
      await db
        .update(careerEvidence)
        .set({ skills: JSON.stringify(skills), description: description || null })
        .where(eq(careerEvidence.id, already.id));
    } else {
      await db.insert(careerEvidence).values({
        id: newId(),
        userId: user.id,
        kind: "activity",
        title: `${activity.name} 회고`,
        description: description || null,
        url: null,
        skills: JSON.stringify(skills),
        sourceType: "retrospective",
        sourceId: activity.id,
        createdAt: now,
      });
    }
  }

  await logHistory(user.id, activity.id, "note", "활동 회고 저장 (STAR)");
  revalidatePath(`/activities/${activity.id}`);
  revalidatePath("/career");
  revalidatePath("/portfolio");
  return { ok: true, id: activity.id };
}
