"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

/**
 * 포트폴리오 공유 링크.
 * 주소를 아는 사람만 볼 수 있는 비공개 링크다 (검색에 걸리지 않게 noindex 로 둔다).
 */

export async function issuePortfolioToken(): Promise<{ ok: true; token: string }> {
  const user = await requireUser();
  const row = (
    await db.select({ token: users.portfolioToken }).from(users).where(eq(users.id, user.id)).limit(1)
  )[0];
  if (row?.token) return { ok: true, token: row.token };

  const token = randomBytes(24).toString("base64url");
  await db.update(users).set({ portfolioToken: token }).where(eq(users.id, user.id));
  revalidatePath("/portfolio");
  return { ok: true, token };
}

/** 새 주소를 발급한다. 이전 주소로는 더 이상 볼 수 없다. */
export async function regeneratePortfolioToken(): Promise<{ ok: true; token: string }> {
  const user = await requireUser();
  const token = randomBytes(24).toString("base64url");
  await db.update(users).set({ portfolioToken: token }).where(eq(users.id, user.id));
  revalidatePath("/portfolio");
  return { ok: true, token };
}

/** 공유를 멈춘다 (주소가 즉시 막힌다) */
export async function disablePortfolioSharing(): Promise<{ ok: true }> {
  const user = await requireUser();
  await db.update(users).set({ portfolioToken: null }).where(eq(users.id, user.id));
  revalidatePath("/portfolio");
  return { ok: true };
}
