"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, careerProfiles, careerEvidence, userSkills } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getProvider, type AIContext, type AIRequest } from "@/services/ai/provider";
import { buildPrompt } from "@/services/ai/prompt-builder";
import { completeWithRetry } from "@/services/ai/evaluator";
import { getUsage, recordUsage, limitMessage } from "@/services/ai/usage";
import { expandSkillsForScoring } from "@/services/career/skill-detect";
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
  const user = await requireUser();
  const clean = text.trim();
  if (clean.replace(/\s/g, "").length < 50) {
    return { ok: false, error: "글이 너무 짧습니다. 이력이나 자기소개를 더 붙여넣어 주세요." };
  }

  // 다른 AI 기능과 같은 하루 상한을 적용한다 (여기만 빠져 있어 비용 상한을 우회할 수 있었다)
  const usage = await getUsage(user.id);
  if (usage.exceeded) return { ok: false, error: limitMessage(usage) };

  try {
    const provider = await getProvider();
    const ctx = emptyContext(clean.slice(0, 20000));
    const request: AIRequest = {
      action: "extract_profile",
      prompt: buildPrompt("extract_profile", ctx),
      context: ctx,
    };
    await recordUsage(user.id);
    const parsed = await completeWithRetry(provider, request);
    if (parsed.kind !== "profile") return { ok: false, error: "분석 결과 형식이 올바르지 않습니다." };
    // 미리보기에서도 점수에 쓰이는 역량 이름(Backend 등)을 보여준다 — 저장 후 갑자기 생기지 않게
    const data = {
      ...parsed.data,
      skills: expandSkillsForScoring(parsed.data.skills),
      evidence: parsed.data.evidence.map((e) => ({ ...e, skills: expandSkillsForScoring(e.skills) })),
    };
    return { ok: true, data };
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
const importSchema = z.object({
  headline: z.string().max(200).optional(),
  summary: z.string().max(2000).optional(),
  skills: z.array(z.string().max(60)).max(60),
  evidence: z
    .array(
      z.object({
        title: z.string().max(300),
        description: z.string().max(3000),
        skills: z.array(z.string().max(60)).max(20),
        kind: z.string().max(30),
      }),
    )
    .max(40),
});

export async function saveProfileImport(
  raw: z.input<typeof importSchema>,
): Promise<{ ok: boolean; error?: string; added: { skills: number; evidence: number } }> {
  const user = await requireUser();
  const now = Date.now();
  const added = { skills: 0, evidence: 0 };
  // 서버 액션은 화면을 거치지 않고도 불릴 수 있다 — 개수·길이를 묶어 둔다
  const parsedInput = importSchema.safeParse(raw);
  if (!parsedInput.success) return { ok: false, error: "저장할 내용이 올바르지 않습니다.", added };
  const input = parsedInput.data;

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

  // 2) 스킬 (이미 있으면 건너뛴다). 카탈로그 역량을 함께 붙여야 점수에 반영된다.
  //    한 번 읽고 한 번에 넣는다 — Neon 은 쿼리 하나가 왕복 하나라 항목마다 묻으면 느리다.
  const skills = expandSkillsForScoring(input.skills);
  const existingSkills = new Set(
    (await db.select({ name: userSkills.name }).from(userSkills).where(eq(userSkills.userId, user.id))).map(
      (r) => r.name,
    ),
  );
  const newSkills = skills.filter((skill) => !existingSkills.has(skill));
  if (newSkills.length > 0) {
    await db.insert(userSkills).values(
      newSkills.map((name) => ({ id: newId(), userId: user.id, name, selfScore: 3, createdAt: now })),
    );
    added.skills = newSkills.length;
  }

  // 3) 근거 (같은 제목은 건너뛴다)
  const existingTitles = new Set(
    (
      await db
        .select({ title: careerEvidence.title })
        .from(careerEvidence)
        .where(eq(careerEvidence.userId, user.id))
    ).map((r) => r.title),
  );
  const evidenceRows = [];
  for (const item of input.evidence) {
    const title = item.title.trim().slice(0, 200);
    if (!title || existingTitles.has(title)) continue;
    const evidenceSkills = expandSkillsForScoring(item.skills);
    if (evidenceSkills.length === 0) continue;
    existingTitles.add(title);
    evidenceRows.push({
      id: newId(),
      userId: user.id,
      kind: ["activity", "project", "award", "certificate", "education", "work"].includes(item.kind)
        ? item.kind
        : "activity",
      title,
      description: item.description.trim().slice(0, 500) || null,
      url: null,
      skills: JSON.stringify(evidenceSkills),
      sourceType: "profile_import",
      sourceId: null,
      createdAt: now,
    });
  }
  if (evidenceRows.length > 0) {
    await db.insert(careerEvidence).values(evidenceRows);
    added.evidence = evidenceRows.length;
  }

  revalidatePath("/career");
  revalidatePath("/career/skills");
  return { ok: true, added };
}
