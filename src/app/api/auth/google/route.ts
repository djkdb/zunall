import { NextRequest, NextResponse } from "next/server";
import {
  STATE_COOKIE,
  authorizeUrl,
  callbackUrl,
  googleAuthEnabled,
  newOAuthState,
} from "@/lib/auth/google";

export const dynamic = "force-dynamic";

/** 구글 로그인 시작 — state 를 쿠키에 심고 구글 동의 화면으로 보낸다. */
export async function GET(request: NextRequest) {
  if (!googleAuthEnabled()) {
    return NextResponse.redirect(new URL("/login?error=google_disabled", request.url));
  }

  const state = newOAuthState();
  const redirectUri = callbackUrl(request.url, request.headers);
  const response = NextResponse.redirect(authorizeUrl(state, redirectUri));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
