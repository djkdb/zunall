import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { issueSession } from "@/lib/auth/session";
import {
  STATE_COOKIE,
  TokenExchangeError,
  callbackUrl,
  exchangeCode,
  googleAuthEnabled,
} from "@/lib/auth/google";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 오류 메시지에서 비밀값이 될 수 있는 부분을 지우고 한 줄로 줄인다 */
function firstLine(message: string): string {
  return message
    .split("\n")[0]
    .replace(/[a-z]+:\/\/[^\s]+/gi, "<주소>")
    .replace(/[\w.+-]+@[\w.-]+/g, "<이메일>")
    .slice(0, 140);
}

/** 구글 콜백 — 코드를 프로필로 교환하고 계정을 만들거나 연결한 뒤 로그인시킨다. */
export async function GET(request: NextRequest) {
  const fail = (reason: string, detail?: string) =>
    NextResponse.redirect(
      new URL(
        `/login?error=${reason}${detail ? `&reason=${encodeURIComponent(detail)}` : ""}`,
        request.url,
      ),
    );

  if (!googleAuthEnabled()) return fail("google_disabled");

  const url = new URL(request.url);
  if (url.searchParams.get("error")) return fail("google_cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) {
    return fail("google_state");
  }

  let profile;
  try {
    profile = await exchangeCode(code, callbackUrl(request.url, request.headers));
  } catch (error) {
    // 클라이언트 ID/시크릿이 틀렸거나 리디렉션 URI 가 콘솔 설정과 다를 때
    const code = error instanceof TokenExchangeError ? error.code : "unknown";
    console.error("google token exchange failed:", code, error instanceof Error ? error.message : error);
    return fail("google_token", code);
  }
  if (!profile.emailVerified) return fail("google_unverified");

  try {

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
          // 로그인 화면에 안내한 대로, 구글로 가입하면 약관에 동의한 것으로 본다.
          termsAgreedAt: Date.now(),
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("google oauth callback failed:", message);
    // users 테이블에 google_id / avatar_url 이 없으면 여기서 걸린다
    if (/column .*(google_id|avatar_url)|does not exist/i.test(message)) {
      return fail("google_db", firstLine(message));
    }
    // 원인을 알 수 없는 실패는 화면에서 바로 볼 수 있게 요약을 함께 넘긴다
    // (접속 문자열·토큰이 섞여 들어가지 않도록 URL·이메일은 지운다)
    return fail("google_failed", firstLine(message));
  }
}
