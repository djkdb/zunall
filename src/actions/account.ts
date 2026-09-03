"use server";

import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  db,
  users,
  sessions,
  passwordResets,
  activities,
  activityTags,
  tags,
  events,
  tasks,
  documents,
  documentBlobs,
  submissions,
  submissionVersions,
  retrospectives,
  essayQuestions,
  essayDrafts,
  evaluationCriteria,
  aiReviews,
  notifications,
  notes,
  activityHistory,
  careerGoals,
  userSkills,
  careerEvidence,
  careerProfiles,
  careerActions,
  roadmapItems,
  scoreSnapshots,
  opportunityAnalyses,
  pushSubscriptions,
  userSettings,
} from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { deleteStoredFile } from "@/lib/storage";
import { requireUser, destroySession, getCurrentUser } from "@/lib/auth/session";
import { mailConfigured, sendEmail } from "@/lib/email";
import { appOrigin } from "@/lib/app-url";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const RESET_TTL_MS = 30 * 60 * 1000; // 30분

// ─── 비밀번호 변경 (로그인 상태) ────────────────────────────────

const changeSchema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(100),
});

/**
 * 비밀번호 변경.
 * 구글 로그인만 쓰던 계정(비밀번호 없음)은 현재 비밀번호 없이 새로 정할 수 있다.
 * 바꾼 뒤에는 지금 브라우저를 뺀 다른 세션을 모두 끊는다.
 */
export async function changePassword(input: z.input<typeof changeSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (user.passwordHash) {
    const current = parsed.data.currentPassword ?? "";
    if (!current) return { ok: false, error: "현재 비밀번호를 입력해주세요." };
    if (!verifyPassword(current, user.passwordHash)) {
      return { ok: false, error: "현재 비밀번호가 올바르지 않습니다." };
    }
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(parsed.data.newPassword) })
    .where(eq(users.id, user.id));

  // 비밀번호를 바꾸면 이전에 로그인해 둔 다른 기기는 로그아웃시킨다.
  await keepOnlyCurrentSession(user.id);
  return { ok: true, message: user.passwordHash ? "비밀번호를 바꿨습니다." : "비밀번호를 설정했습니다." };
}

/** 지금 쓰는 세션만 남기고 나머지는 삭제 */
async function keepOnlyCurrentSession(userId: string): Promise<void> {
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get("cavero_session")?.value;
  const rows = await db.select({ token: sessions.token }).from(sessions).where(eq(sessions.userId, userId));
  const others = rows.map((r) => r.token).filter((t) => t !== token);
  if (others.length > 0) {
    await db.delete(sessions).where(inArray(sessions.token, others));
  }
}

// ─── 비밀번호 재설정 (로그아웃 상태) ────────────────────────────

/** 메일 발송이 설정돼 있는지 — 화면에서 안내 문구를 고르는 데 쓴다 */
export async function passwordResetAvailable(): Promise<boolean> {
  return mailConfigured();
}

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email("올바른 이메일 형식이 아닙니다.") });

/**
 * 재설정 메일 요청.
 * 가입 여부는 알려주지 않는다 (계정 존재 여부가 새어 나가지 않도록).
 */
export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (!mailConfigured()) {
    return {
      ok: false,
      error:
        "이 서비스는 아직 메일 발송이 설정돼 있지 않습니다. 구글 로그인으로 접속한 뒤 설정에서 비밀번호를 정해주세요.",
    };
  }

  const sameAnswer: ActionResult = {
    ok: true,
    message: "가입된 이메일이라면 재설정 링크를 보냈습니다. 메일함을 확인해주세요.",
  };

  const user = (await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1))[0];
  if (!user) return sameAnswer;

  // 이 사용자의 이전 토큰은 모두 무효화하고 하나만 새로 발급한다.
  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));

  const token = randomBytes(32).toString("hex");
  await db.insert(passwordResets).values({
    token,
    userId: user.id,
    expiresAt: Date.now() + RESET_TTL_MS,
    createdAt: Date.now(),
  });

  const origin = await appOrigin();
  await sendEmail({
    to: user.email,
    subject: "[Cavero] 비밀번호 재설정 안내",
    text: [
      `${user.name}님, 안녕하세요.`,
      "",
      "아래 링크에서 새 비밀번호를 정할 수 있습니다. 30분 안에 사용해주세요.",
      `${origin}/reset/${token}`,
      "",
      "본인이 요청한 것이 아니라면 이 메일을 무시하셔도 됩니다.",
      "— Cavero",
    ].join("\n"),
  });

  return sameAnswer;
}

const resetSchema = z.object({
  token: z.string().min(10).max(200),
  newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(100),
});

export async function resetPassword(input: z.input<typeof resetSchema>): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const row = (await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.token, parsed.data.token))
    .limit(1))[0];

  if (!row || row.usedAt || row.expiresAt < Date.now()) {
    return { ok: false, error: "링크가 만료되었거나 이미 사용되었습니다. 다시 요청해주세요." };
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(parsed.data.newPassword) })
    .where(eq(users.id, row.userId));
  await db.update(passwordResets).set({ usedAt: Date.now() }).where(eq(passwordResets.token, row.token));
  // 재설정했으면 기존 로그인은 모두 끊는다.
  await db.delete(sessions).where(eq(sessions.userId, row.userId));

  return { ok: true, message: "비밀번호를 바꿨습니다. 새 비밀번호로 로그인해주세요." };
}

// ─── 회원 탈퇴 ─────────────────────────────────────────────────

/**
 * 계정과 계정에 딸린 모든 자료를 지운다.
 * 되돌릴 수 없으므로 이메일을 정확히 입력했을 때만 진행한다.
 */
export async function deleteAccount(input: { confirmEmail: string }): Promise<never | ActionResult> {
  const user = await requireUser();
  if (input.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "확인을 위해 가입한 이메일을 정확히 입력해주세요." };
  }

  const userId = user.id;

  // 부모 키로만 연결된 자료부터 (user_id 컬럼이 없다)
  const actIds = (await db.select({ id: activities.id }).from(activities).where(eq(activities.userId, userId))).map((a) => a.id);
  const subIds = (await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.userId, userId))).map((s) => s.id);

  // 외부 저장소(R2 등)에 올라간 파일은 DB 를 지운다고 사라지지 않는다.
  const docs = await db
    .select({ storagePath: documents.storagePath })
    .from(documents)
    .where(eq(documents.userId, userId));
  for (const doc of docs) await deleteStoredFile(doc.storagePath);

  if (actIds.length > 0) {
    await db.delete(activityTags).where(inArray(activityTags.activityId, actIds));
    await db.delete(evaluationCriteria).where(inArray(evaluationCriteria.activityId, actIds));
  }
  if (subIds.length > 0) {
    await db.delete(submissionVersions).where(inArray(submissionVersions.submissionId, subIds));
  }
  // 업로드한 파일 본문 (DB 저장 방식). user_id 로 바로 지운다.
  await db.delete(documentBlobs).where(eq(documentBlobs.userId, userId));

  // user_id 로 직접 연결된 자료
  await Promise.all([
    db.delete(essayDrafts).where(eq(essayDrafts.userId, userId)),
    db.delete(essayQuestions).where(eq(essayQuestions.userId, userId)),
    db.delete(retrospectives).where(eq(retrospectives.userId, userId)),
    db.delete(aiReviews).where(eq(aiReviews.userId, userId)),
    db.delete(submissions).where(eq(submissions.userId, userId)),
    db.delete(documents).where(eq(documents.userId, userId)),
    db.delete(tasks).where(eq(tasks.userId, userId)),
    db.delete(events).where(eq(events.userId, userId)),
    db.delete(notes).where(eq(notes.userId, userId)),
    db.delete(notifications).where(eq(notifications.userId, userId)),
    db.delete(activityHistory).where(eq(activityHistory.userId, userId)),
  ]);

  await Promise.all([
    db.delete(careerActions).where(eq(careerActions.userId, userId)),
    db.delete(careerEvidence).where(eq(careerEvidence.userId, userId)),
    db.delete(careerGoals).where(eq(careerGoals.userId, userId)),
    db.delete(careerProfiles).where(eq(careerProfiles.userId, userId)),
    db.delete(userSkills).where(eq(userSkills.userId, userId)),
    db.delete(roadmapItems).where(eq(roadmapItems.userId, userId)),
    db.delete(scoreSnapshots).where(eq(scoreSnapshots.userId, userId)),
    db.delete(opportunityAnalyses).where(eq(opportunityAnalyses.userId, userId)),
    db.delete(tags).where(eq(tags.userId, userId)),
    db.delete(activities).where(eq(activities.userId, userId)),
  ]);

  await Promise.all([
    db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)),
    db.delete(userSettings).where(eq(userSettings.userId, userId)),
    db.delete(passwordResets).where(eq(passwordResets.userId, userId)),
    db.delete(sessions).where(eq(sessions.userId, userId)),
  ]);

  await db.delete(users).where(eq(users.id, userId));
  await destroySession();
  redirect("/login?deleted=1");
}

/** 지금 계정이 비밀번호를 갖고 있는지 (설정 화면 문구용) */
export async function hasPassword(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user?.passwordHash;
}
