"use client";

import * as React from "react";
import { Loader2, Check } from "lucide-react";
import { changePassword } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 비밀번호 변경. 구글 로그인만 쓰던 계정은 현재 비밀번호 없이 새로 정한다. */
export function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = String(form.get("newPassword") ?? "");
    if (next !== String(form.get("confirm") ?? "")) {
      return setError("두 비밀번호가 서로 다릅니다.");
    }
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await changePassword({
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: next,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setMessage(result.message ?? "비밀번호를 바꿨습니다.");
    formRef.current?.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>비밀번호</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={submit} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {hasPassword
              ? "바꾸면 이 브라우저를 뺀 다른 기기는 로그아웃됩니다."
              : "구글 로그인으로 가입한 계정입니다. 비밀번호를 정하면 이메일로도 로그인할 수 있습니다."}
          </p>

          {hasPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">현재 비밀번호</Label>
              <Input
                id="pw-current"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">새 비밀번호</Label>
            <Input
              id="pw-new"
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="8자 이상"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">새 비밀번호 확인</Label>
            <Input id="pw-confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {message && <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}

          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : message ? <Check className="h-4 w-4" /> : null}
            {hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
