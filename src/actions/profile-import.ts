"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, careerProfiles, careerEvidence, userSkills } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getProvider, type AIContext, type AIRequest } from "@/services/ai/provider";
import { buildPrompt } from "@/services/ai/prompt-builder";
import { completeWithRetry } from "@/services/ai/evaluator";
import { normalizeSkillNames } from "@/services/career/skill-detect";
import { extractText, isExtractable } from "@/services/document/extract";
import { newId } from "@/lib/utils";
import type { ProfileExtract } from "@/services/ai/schemas";

export interface ProfileImportPreview {
  ok: boolean;
  error?: string;
  data?: ProfileExtract;
}

function emptyContext(text: string): AIContext {
  return {
    activityName: "내 이력",
    activityType: "etc",
    organizer: null,
    criteria: [],
    announcementText: "",
    submissionText: text,
    submissionTitle: null,
    userProfile: "",
  };
}

/** 붙여넣은 이력/자기소개 글에서 프로필 재료를 뽑아 미리 보여준다 (저장 전) */
export async function analyzeProfileText(text: string): Promise<ProfileImportPreview> {
  await requireUser();
  const clean = text.trim();
  if (clean.replace(/\s/g, "").length < 50) {
    return { ok: false, error: "글이 너무 짧습니다. 이력이나 자기소개를 더 붙여넣어 주세요." };
  }

  try {
    const provider = await getProvider();
    const ctx = emptyContext(clean.slice(0, 20000));
    const request: AIRequest = {
      action: "extract_profile",
      prompt: buildPrompt("extract_profile", ctx),
      context: ctx,
    };
    const parsed = await completeWithRetry(provider, request);
    if (parsed.kind !== "profile") return { ok: false, error: "분석 결과 형식이 올바르지 않습니다." };
    return { ok: true, data: parsed.data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.",
    };
  }
}

/** 이력서 파일(PDF/DOCX/TXT)에서 텍스트를 뽑아 같은 분석을 돌린다 */
export async function analyzeProfileFile(formData: FormData): Promise<ProfileImportPreview> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "파일을 선택해주세요." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "파일이 너무 큽니다 (10MB 제한)." };
  if (!isExtractable(file.name)) {
    return { ok: false, error: "PDF·DOCX·PPTX·TXT 파일에서만 읽을 수 있습니다." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractText(buffer, file.name);
  if (!extracted.ok || !extracted.text.trim()) {
    return { ok: false, error: extracted.error ?? "파일에서 텍스트를 읽지 못했습니다." };
  }
  return analyzeProfileText(extracted.text);
}

/**
 * 사용자가 확인한 내용만 실제로 저장한다.
 * AI 가 임의로 경력을 만들지 않도록, 저장은 반드시 이 확인 단계를 거친다.
 */
export async function saveProfileImport(input: {
  headline?: string;
  summary?: string;
  skills: string[];
  evidence: Array<{ title: string; description: string; skills: string[]; kind: string }>;
}): Promise<{ ok: boolean; error?: string; added: { skills: number; evidence: number } }> {
  const user = await requireUser();
  const now = Date.now();
  const added = { skills: 0, evidence: 0 };

  // 1) 프로필 문장
  const profile = (
    await db.select().from(careerProfiles).where(eq(careerProfiles.userId, user.id)).limit(1)
  )[0];
  const headline = input.headline?.trim();
  const summary = input.summary?.trim();
  if (headline || summary) {
    if (profile) {
      await db
        .update(careerProfiles)
        .set({
          headline: headline || profile.headline,
          summary: summary || profile.summary,
          updatedAt: now,
        })
        .where(eq(careerProfiles.userId, user.id));
    } else {
      await db.insert(careerProfiles).values({
        id: newId(),
        userId: user.id,
        headline: headline || null,
        summary: summary || null,
        updatedAt: now,
      });
    }
  }

  // 2) 스킬 (이미 있으면 건너뛴다)
  const skills = normalizeSkillNames(input.skills);
  for (const skill of skills) {
    const existing = (
      await db
        .select({ id: userSkills.id })
        .from(userSkills)
        .where(and(eq(userSkills.userId, user.id), eq(userSkills.name, skill)))
        .limit(1)
    )[0];
    if (existing) continue;
    await db.insert(userSkills).values({
      id: newId(),
      userId: user.id,
      name: skill,
      selfScore: 3,
      createdAt: now,
    });
    added.skills++;
  }

  // 3) 근거
  for (const item of input.evidence) {
    const title = item.title.trim();
    if (!title) continue;
    const evidenceSkills = normalizeSkillNames(item.skills);
    if (evidenceSkills.length === 0) continue;

    const duplicate = (
      await db
        .select({ id: careerEvidence.id })
        .from(careerEvidence)
        .where(and(eq(careerEvidence.userId, user.id), eq(careerEvidence.title, title)))
        .limit(1)
    )[0];
    if (duplicate) continue;

    await db.insert(careerEvidence).values({
      id: newId(),
      userId: user.id,
      kind: ["activity", "project", "award", "certificate", "education", "work"].includes(item.kind)
        ? item.kind
        : "activity",
      title: title.slice(0, 200),
      description: item.description.trim().slice(0, 500) || null,
      url: null,
      skills: JSON.stringify(evidenceSkills),
      sourceType: "profile_import",
      sourceId: null,
      createdAt: now,
    });
    added.evidence++;
  }

  revalidatePath("/career");
  revalidatePath("/career/skills");
  return { ok: true, added };
}
