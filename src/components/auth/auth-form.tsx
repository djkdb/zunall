"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { login, signup, type AuthFormState } from "@/actions/auth";
import { CaveroMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OAUTH_ERRORS: Record<string, string> = {
  google_disabled: "구글 로그인이 아직 설정되지 않았습니다.",
  google_cancelled: "구글 로그인을 취소했습니다.",
  google_state: "보안 확인에 실패했습니다. 다시 시도해주세요.",
  google_unverified: "이메일이 확인되지 않은 구글 계정입니다.",
  google_token:
    "구글 인증 정보가 맞지 않습니다. GOOGLE_CLIENT_ID·SECRET 과 콘솔의 리디렉션 URI 를 확인해주세요.",
  google_db:
    "데이터베이스에 구글 로그인용 컬럼이 없습니다. migrations/001-google-login.sql 을 실행해주세요.",
  google_failed: "구글 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
};

/** 구글 브랜드 마크 (구글 가이드라인에 맞춘 4색 G) */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l6.9 5.4c4.1-3.8 6.6-9.4 6.6-15.7z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 9.9l7.1-5.5z" />
      <path fill="#EA4335" d="M24 10.7c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.5 29.9 2 24 2 15.4 2 8 6.9 4.4 14.1l7.1 5.5c1.8-5.3 6.7-8.9 12.5-8.9z" />
    </svg>
  );
}

export function AuthForm({
  mode,
  googleEnabled = false,
  errorCode,
}: {
  mode: "login" | "signup";
  googleEnabled?: boolean;
  errorCode?: string;
}) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    undefined,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 dark:bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <CaveroMark className="h-12 w-12 text-[#0F2338] dark:text-foreground" />
          <h1 className="text-xl font-bold tracking-[0.3em]">CAVERO</h1>
          <p className="text-center text-sm text-muted-foreground">
            스펙을 쌓는 게 아니라, 다음 합격을 설계합니다
          </p>
        </div>

        {errorCode && OAUTH_ERRORS[errorCode] && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
            {OAUTH_ERRORS[errorCode]}
          </p>
        )}

        {googleEnabled && (
          <div className="mb-4 space-y-4">
            <a
              href="/api/auth/google"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border bg-card text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
            >
              <GoogleMark />
              구글로 계속하기
            </a>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">또는 이메일로</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        <form
          action={formAction}
          className="space-y-4 rounded-lg border bg-card p-6 shadow-sm"
        >
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">이름</Label>
              <Input id="name" name="name" placeholder="홍길동" required maxLength={50} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={mode === "signup" ? "8자 이상" : "••••••••"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 8 : 1}
            />
          </div>

          {state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "로그인" : "회원가입"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              계정이 없나요?{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                회원가입
              </Link>
            </>
          ) : (
            <>
              이미 계정이 있나요?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                로그인
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
