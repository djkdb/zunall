"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { login, signup, type AuthFormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    undefined,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 dark:bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-bold tracking-tight">Zunall</h1>
          <p className="text-center text-sm text-muted-foreground">
            공모전부터 최종 제출까지, 나의 대외활동 OS
          </p>
        </div>

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
