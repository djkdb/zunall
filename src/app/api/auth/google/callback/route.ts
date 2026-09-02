import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { issueSession } from "@/lib/auth/session";
import { STATE_COOKIE, callbackUrl, exchangeCode, googleAuthEnabled } from "@/lib/auth/google";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 구글 콜백 — 코드를 프로필로 교환하고 계정을 만들거나 연결한 뒤 로그인시킨다. */
export async function GET(request: NextRequest) {
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

  if (!googleAuthEnabled()) return fail("google_disabled");

  const url = new URL(request.url);
  if (url.searchParams.get("error")) return fail("google_cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) {
    return fail("google_state");
  }

  try {
    const profile = await exchangeCode(code, callbackUrl(request.url, request.headers));
    if (!profile.emailVerified) return fail("google_unverified");

    const byGoogle = (
      await db.select().from(users).where(eq(users.googleId, profile.googleId)).limit(1)
    )[0];

    let userId: string;
    if (byGoogle) {
      userId = byGoogle.id;
    } else {
      const byEmail = (
        await db.select().from(users).where(eq(users.email, profile.email)).limit(1)
      )[0];
      if (byEmail) {
        // 같은 이메일로 이미 가입돼 있으면 구글 계정을 연결한다
        userId = byEmail.id;
        await db
          .update(users)
          .set({ googleId: profile.googleId, avatarUrl: profile.picture ?? byEmail.avatarUrl })
          .where(eq(users.id, byEmail.id));
      } else {
        userId = newId();
        await db.insert(users).values({
          id: userId,
          email: profile.email,
          name: profile.name,
          passwordHash: null,
          googleId: profile.googleId,
          avatarUrl: profile.picture,
          createdAt: Date.now(),
        });
      }
    }

    const session = await issueSession(userId);
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(session.name, session.value, session.options);
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("google oauth callback failed:", error instanceof Error ? error.message : error);
    return fail("google_failed");
  }
}
