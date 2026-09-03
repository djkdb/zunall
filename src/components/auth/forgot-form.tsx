"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/actions/account";
import { CaveroMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 비밀번호 재설정 요청.
 * 메일 발송이 설정돼 있지 않은 배포에서는 그 사실을 그대로 알린다
 * ("보냈습니다"라고 해놓고 아무 일도 안 일어나는 게 가장 나쁘다).
 */
export function ForgotForm({ mailReady }: { mailReady: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const result = await requestPasswordReset({ email: String(form.get("email") ?? "") });
    setPending(false);
    if (result.ok) setMessage(result.message ?? "메일을 보냈습니다.");
    else setError(result.error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 dark:bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <CaveroMark className="h-12 w-12 text-[#0F2338] dark:text-foreground" />
          <h1 className="text-xl font-bold tracking-[0.3em]">CAVERO</h1>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold">비밀번호 재설정</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {mailReady
                ? "가입한 이메일을 입력하면 재설정 링크를 보내드립니다."
                : "이 서비스는 아직 메일 발송이 설정되어 있지 않습니다."}
            </p>
          </div>

          {mailReady ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
              )}
              {message && (
                <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  {message}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                재설정 링크 받기
              </Button>
            </>
          ) : (
            <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
              구글 로그인으로 접속한 뒤 <strong>설정 &gt; 비밀번호</strong>에서 새 비밀번호를 정할 수
              있습니다. 그래도 들어갈 수 없다면 운영자에게 문의해주세요.
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
