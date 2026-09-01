"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  careerGoals,
  careerProfiles,
  careerActions,
  careerEvidence,
  userSkills,
  roadmapItems,
  tasks,
} from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { pushNotification } from "@/lib/history";
import { newId } from "@/lib/utils";
import { getCareerContext, recordScoreSnapshot } from "@/lib/career-queries";
import { importEvidenceFromActivities } from "@/services/career/evidence-import";
import { normalizeSkillNames } from "@/services/career/skill-detect";
import { rankActions } from "@/services/career/mission";
import { SKILL_CATALOG, EVIDENCE_KINDS } from "@/lib/career-constants";
import type { ActionResult } from "@/actions/activities";

function revalidateCareer() {
  revalidatePath("/");
  revalidatePath("/career");
  revalidatePath("/career/gaps");
  revalidatePath("/career/skills");
  revalidatePath("/career/roadmap");
  revalidatePath("/opportunities");
  revalidatePath("/stats");
}

/** 컨텍스트 재계산 후 Career Score 스냅샷 기록 */
async function snapshot(userId: string) {
  const ctx = await getCareerContext(userId);
  await recordScoreSnapshot(userId, ctx.readiness.score, ctx.readiness.items);
}

// ─── 목표 ────────────────────────────────────────────────────

const goalSchema = z.object({
  type: z.enum(["ROLE", "COMPANY", "INDUSTRY", "GENERAL"]),
  name: z.string().trim().min(1, "목표를 입력해주세요.").max(120),
  description: z.string().max(1000).optional(),
  targetRolesText: z.string().max(300).optional(),
  targetCompaniesText: z.string().max(300).optional(),
  targetPeriod: z.string().max(60).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("HIGH"),
});
export type GoalInput = z.input<typeof goalSchema>;

function splitList(text: string | undefined): string[] {
  return (text ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

/** 활성 목표 저장 (기존 활성 목표가 있으면 갱신, 없으면 생성) */
export async function saveGoal(input: GoalInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const existing = (await db
    .select()
    .from(careerGoals)
    .where(and(eq(careerGoals.userId, user.id), eq(careerGoals.isActive, 1)))
    .limit(1))[0];

  const values = {
    type: data.type,
    name: data.name,
    description: data.description?.trim() || null,
    targetRoles: JSON.stringify(splitList(data.targetRolesText)),
    targetCompanies: JSON.stringify(splitList(data.targetCompaniesText)),
    targetPeriod: data.targetPeriod?.trim() || null,
    priority: data.priority,
    updatedAt: Date.now(),
  };

  let id: string;
  if (existing) {
    id = existing.id;
    await db.update(careerGoals).set(values).where(eq(careerGoals.id, existing.id));
  } else {
    id = newId();
    await db.insert(careerGoals)
      .values({ id, userId: user.id, isActive: 1, createdAt: Date.now(), ...values });
  }

  await snapshot(user.id);
  revalidateCareer();
  return { ok: true, id };
}

// ─── 프로필 ──────────────────────────────────────────────────

const profileSchema = z.object({
  headline: z.string().max(80).optional(),
  summary: z.string().max(2000).optional(),
  desiredRolesText: z.string().max(300).optional(),
  desiredCompaniesText: z.string().max(300).optional(),
  githubUsername: z.string().max(60).optional(),
});
export type ProfileInput = z.input<typeof profileSchema>;

export async function saveProfileBasics(input: ProfileInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const existing = (await db
    .select()
    .from(careerProfiles)
    .where(eq(careerProfiles.userId, user.id))
    .limit(1))[0];

  const values = {
    headline: data.headline?.trim() || null,
    summary: data.summary?.trim() || null,
    desiredRoles: JSON.stringify(splitList(data.desiredRolesText)),
    desiredCompanies: JSON.stringify(splitList(data.desiredCompaniesText)),
    githubUsername: data.githubUsername?.trim().replace(/^@/, "") || null,
    updatedAt: Date.now(),
  };

  if (existing) {
    await db.update(careerProfiles).set(values).where(eq(careerProfiles.id, existing.id));
  } else {
    await db.insert(careerProfiles).values({ id: newId(), userId: user.id, ...values });
  }

  await snapshot(user.id);
  revalidateCareer();
  return { ok: true };
}

/** 온보딩 완료: 활동→근거 임포트 + 프로필 onboarded 표시 + 첫 스냅샷 */
export async function completeOnboarding(): Promise<ActionResult> {
  const user = await requireUser();
  const imported = await importEvidenceFromActivities(user.id);

  const existing = (await db
    .select()
    .from(careerProfiles)
    .where(eq(careerProfiles.userId, user.id))
    .limit(1))[0];
  if (existing) {
    await db.update(careerProfiles)
      .set({ onboardedAt: existing.onboardedAt ?? Date.now(), updatedAt: Date.now() })
      .where(eq(careerProfiles.id, existing.id));
  } else {
    await db.insert(careerProfiles)
      .values({ id: newId(), userId: user.id, onboardedAt: Date.now(), updatedAt: Date.now() });
  }

  await snapshot(user.id);
  if (imported > 0) {
    await pushNotification({
      userId: user.id,
      type: "system",
      title: "커리어 프로필 준비 완료",
      body: `기존 활동에서 근거 ${imported}개를 가져왔습니다.`,
    });
  }
  revalidateCareer();
  return { ok: true };
}

/** 활동 데이터에서 근거 다시 가져오기 */
export async function importActivityEvidence(): Promise<ActionResult> {
  const user = await requireUser();
  const imported = await importEvidenceFromActivities(user.id);
  await snapshot(user.id);
  revalidateCareer();
  return imported > 0
    ? { ok: true }
    : { ok: false, error: "가져올 새 활동이 없습니다. (관심/지원 예정 상태는 제외됩니다)" };
}

// ─── 스킬 ────────────────────────────────────────────────────

export async function addSkill(name: string, selfScore?: number | null): Promise<ActionResult> {
  const user = await requireUser();
  const trimmed = name.trim().slice(0, 30);
  if (!trimmed) return { ok: false, error: "스킬 이름을 입력해주세요." };

  const [normalized] = normalizeSkillNames([trimmed]);
  const existing = (await db
    .select()
    .from(userSkills)
    .where(and(eq(userSkills.userId, user.id), eq(userSkills.name, normalized)))
    .limit(1))[0];
  if (existing) return { ok: false, error: "이미 등록된 스킬입니다." };

  const catalog = SKILL_CATALOG.find((s) => s.name === normalized);
  const score =
    selfScore !== undefined && selfScore !== null && Number.isFinite(selfScore)
      ? Math.max(0, Math.min(100, Math.round(selfScore)))
      : null;

  await db.insert(userSkills)
    .values({
      id: newId(),
      userId: user.id,
      name: normalized,
      category: catalog?.category ?? "tech",
      selfScore: score,
      createdAt: Date.now(),
    });

  await snapshot(user.id);
  revalidateCareer();
  return { ok: true };
}

export async function removeSkill(skillId: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.delete(userSkills)
    .where(and(eq(userSkills.id, skillId), eq(userSkills.userId, user.id)));
  await snapshot(user.id);
  revalidateCareer();
  return { ok: true };
}

// ─── 근거 (Evidence) ─────────────────────────────────────────

const evidenceSchema = z.object({
  kind: z.enum(Object.keys(EVIDENCE_KINDS) as [string, ...string[]]),
  title: z.string().trim().min(1, "제목을 입력해주세요.").max(150),
  description: z.string().max(1000).optional(),
  url: z.string().max(500).optional(),
  skillsText: z.string().max(300).optional(),
});
export type EvidenceInput = z.input<typeof evidenceSchema>;

export async function addEvidence(input: EvidenceInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = evidenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const skills = normalizeSkillNames(splitList(data.skillsText));
  if (skills.length === 0) {
    return { ok: false, error: "이 근거가 뒷받침하는 스킬을 1개 이상 입력해주세요." };
  }

  await db.insert(careerEvidence)
    .values({
      id: newId(),
      userId: user.id,
      kind: data.kind,
      title: data.title,
      description: data.description?.trim() || null,
      url: data.url?.trim() || null,
      skills: JSON.stringify(skills),
      sourceType: "manual",
      sourceId: null,
      createdAt: Date.now(),
    });

  await snapshot(user.id);
  revalidateCareer();
  return { ok: true };
}

export async function deleteEvidence(evidenceId: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.delete(careerEvidence)
    .where(and(eq(careerEvidence.id, evidenceId), eq(careerEvidence.userId, user.id)));
  await snapshot(user.id);
  revalidateCareer();
  return { ok: true };
}

// ─── 미션 / 추천 행동 ────────────────────────────────────────

const missionSchema = z.object({
  skill: z.string().max(60),
  title: z.string().trim().min(1).max(200),
  reason: z.string().max(500).optional(),
  expectedEffect: z.number().min(0).max(20),
  expectedMinutes: z.number().min(5).max(3000),
});
export type MissionInput = z.input<typeof missionSchema>;

/** 추천 행동 수락 → career_action(accepted) + Task 생성 */
export async function acceptMission(input: MissionInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = missionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "추천 행동 정보가 올바르지 않습니다." };
  const data = parsed.data;

  const dup = (await db
    .select({ id: careerActions.id })
    .from(careerActions)
    .where(and(eq(careerActions.userId, user.id), eq(careerActions.title, data.title)))
    .limit(1))[0];
  if (dup) return { ok: false, error: "이미 등록된 행동입니다." };

  const ctx = await getCareerContext(user.id);

  const maxPos = (await db
    .select({ position: tasks.position })
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(desc(tasks.position))
    .limit(1))[0];

  const taskId = newId();
  const now = Date.now();
  // 미션 Task는 대시보드 '해야 할 일'에 보이도록 3일 뒤 마감을 기본 부여
  const due = new Date(now + 3 * 86400000);
  const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
  await db.insert(tasks)
    .values({
      id: taskId,
      userId: user.id,
      activityId: null,
      title: data.title,
      description: `[Career Mission · ${data.skill}] ${data.reason ?? ""}\n예상 효과: Career Score +${data.expectedEffect} · 예상 소요: ${Math.round(data.expectedMinutes / 60 * 10) / 10}시간`,
      dueDate,
      priority: "high",
      status: "todo",
      position: (maxPos?.position ?? 0) + 1,
      sourceReviewId: null,
      createdAt: now,
      updatedAt: now,
    });

  await db.insert(careerActions)
    .values({
      id: newId(),
      userId: user.id,
      goalId: ctx.goal?.id ?? null,
      skill: data.skill,
      title: data.title,
      reason: data.reason ?? null,
      expectedEffect: data.expectedEffect,
      expectedMinutes: data.expectedMinutes,
      status: "accepted",
      taskId,
      createdAt: now,
      updatedAt: now,
    });

  revalidateCareer();
  return { ok: true, id: taskId };
}

/** 추천 행동 숨기기 (다른 행동이 추천됨) */
export async function dismissMission(input: MissionInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = missionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "추천 행동 정보가 올바르지 않습니다." };
  const data = parsed.data;
  const now = Date.now();

  await db.insert(careerActions)
    .values({
      id: newId(),
      userId: user.id,
      goalId: null,
      skill: data.skill,
      title: data.title,
      reason: data.reason ?? null,
      expectedEffect: data.expectedEffect,
      expectedMinutes: data.expectedMinutes,
      status: "dismissed",
      createdAt: now,
      updatedAt: now,
    });

  revalidateCareer();
  return { ok: true };
}

// ─── 로드맵 ──────────────────────────────────────────────────

const roadmapItemSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "월을 선택해주세요."),
  title: z.string().trim().min(1, "제목을 입력해주세요.").max(200),
  description: z.string().max(500).optional(),
});
export type RoadmapItemInput = z.input<typeof roadmapItemSchema>;

export async function addRoadmapItem(input: RoadmapItemInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = roadmapItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const ctx = await getCareerContext(user.id);
  const count = (
    await db
      .select({ id: roadmapItems.id })
      .from(roadmapItems)
      .where(eq(roadmapItems.userId, user.id))

  ).length;

  await db.insert(roadmapItems)
    .values({
      id: newId(),
      userId: user.id,
      goalId: ctx.goal?.id ?? null,
      month: data.month,
      title: data.title,
      description: data.description?.trim() || null,
      status: "planned",
      position: count,
      createdAt: Date.now(),
    });

  revalidatePath("/career/roadmap");
  return { ok: true };
}

/** Gap 추천 행동으로 3개월 로드맵 자동 생성 */
export async function generateRoadmap(): Promise<ActionResult> {
  const user = await requireUser();
  const ctx = await getCareerContext(user.id);
  if (ctx.gaps.length === 0) {
    return { ok: false, error: "Gap이 없습니다. 목표를 먼저 설정해주세요." };
  }

  const existingTitles = new Set(
    (
      await db
        .select({ title: roadmapItems.title })
        .from(roadmapItems)
        .where(eq(roadmapItems.userId, user.id))

    ).map((r) => r.title),
  );
  const candidates = rankActions(ctx.gaps, existingTitles, 9);
  if (candidates.length === 0) {
    return { ok: false, error: "추가할 새 추천 행동이 없습니다." };
  }

  const now = new Date();
  let created = 0;
  for (const [index, candidate] of candidates.entries()) {
    const monthOffset = Math.floor(index / 3); // 월당 3개
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    await db.insert(roadmapItems)
      .values({
        id: newId(),
        userId: user.id,
        goalId: ctx.goal?.id ?? null,
        month,
        title: candidate.title,
        description: `[${candidate.skill}] ${candidate.reason} (예상 효과 +${candidate.expectedEffect})`,
        status: "planned",
        position: index,
        createdAt: Date.now(),
      });
    created++;
  }

  revalidatePath("/career/roadmap");
  return { ok: true, id: String(created) };
}

export async function setRoadmapStatus(itemId: string, status: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!["planned", "in_progress", "done"].includes(status)) {
    return { ok: false, error: "잘못된 상태입니다." };
  }
  await db.update(roadmapItems)
    .set({ status })
    .where(and(eq(roadmapItems.id, itemId), eq(roadmapItems.userId, user.id)));
  revalidatePath("/career/roadmap");
  return { ok: true };
}

export async function deleteRoadmapItem(itemId: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.delete(roadmapItems)
    .where(and(eq(roadmapItems.id, itemId), eq(roadmapItems.userId, user.id)));
  revalidatePath("/career/roadmap");
  return { ok: true };
}

/** 로드맵 항목을 Task로 등록 */
export async function roadmapItemToTask(itemId: string): Promise<ActionResult> {
  const user = await requireUser();
  const item = (await db
    .select()
    .from(roadmapItems)
    .where(and(eq(roadmapItems.id, itemId), eq(roadmapItems.userId, user.id)))
    .limit(1))[0];
  if (!item) return { ok: false, error: "로드맵 항목을 찾을 수 없습니다." };
  if (item.taskId) return { ok: false, error: "이미 작업으로 등록되어 있습니다." };

  const maxPos = (await db
    .select({ position: tasks.position })
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(desc(tasks.position))
    .limit(1))[0];

  const taskId = newId();
  const now = Date.now();
  const due = new Date(now + 7 * 86400000);
  const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
  await db.insert(tasks)
    .values({
      id: taskId,
      userId: user.id,
      title: item.title,
      description: `[Roadmap ${item.month}] ${item.description ?? ""}`,
      dueDate,
      priority: "high",
      status: "todo",
      position: (maxPos?.position ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    });
  await db.update(roadmapItems)
    .set({ taskId, status: "in_progress" })
    .where(eq(roadmapItems.id, itemId));

  revalidatePath("/career/roadmap");
  revalidatePath("/");
  return { ok: true, id: taskId };
}
