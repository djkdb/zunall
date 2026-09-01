import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cache } from "react";
import { db, sessions, users, type UserRow } from "@/lib/db";

const COOKIE_NAME = "zunall_session";

function sessionDays(): number {
  const n = Number(process.env.SESSION_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + sessionDays() * 86400000;
  await db.insert(sessions).values({ token, userId, expiresAt }).run();
  // 만료된 세션 정리 (부수 작업)
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now())).run();

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionDays() * 86400,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token)).run();
  }
  cookieStore.delete(COOKIE_NAME);
}

/** 현재 로그인 사용자. 없으면 null. 요청 단위로 캐시됨. */
export const getCurrentUser = cache(async (): Promise<UserRow | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, Date.now())))
    .all();

  return rows[0]?.user ?? null;
});

/** 로그인 필수 페이지/액션에서 호출. 미로그인 시 /login으로 리다이렉트. */
export async function requireUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
