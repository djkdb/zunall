"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/actions/account";
import { CaveroMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** 메일로 받은 링크에서 새 비밀번호를 정한다. */
export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = String(form.get("newPassword") ?? "");
    if (next !== String(form.get("confirm") ?? "")) {
      return setError("두 비밀번호가 서로 다릅니다.");
    }
    setPending(true);
    setError(null);
    const result = await resetPassword({ token, newPassword: next });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 dark:bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <CaveroMark className="h-12 w-12 text-[#0F2338] dark:text-foreground" />
          <h1 className="text-xl font-bold tracking-[0.3em]">CAVERO</h1>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold">새 비밀번호 설정</h2>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">새 비밀번호</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="8자 이상"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">새 비밀번호 확인</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          {done && (
            <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              비밀번호를 바꿨습니다. 로그인 화면으로 이동합니다.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending || done}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            비밀번호 변경
          </Button>
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
