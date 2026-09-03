"use client";

import * as React from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { deleteAccount } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 계정 삭제. 되돌릴 수 없으므로 이메일을 정확히 입력해야 진행된다. */
export function DangerCard({ email }: { email: string }) {
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    const result = await deleteAccount({ confirmEmail: confirm });
    setPending(false);
    // 성공하면 서버에서 /login 으로 보내므로 여기 남는 건 실패한 경우뿐이다.
    if (result && !result.ok) setError(result.error);
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-destructive">
          <TriangleAlert className="h-4 w-4" />
          계정 삭제
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          활동·문서·업로드 파일·커리어 기록·알림 설정이 <strong>모두 즉시 삭제</strong>되며 되돌릴 수
          없습니다. 남기고 싶은 자료가 있다면 먼저 데이터 백업에서 내려받으세요.
        </p>

        {!open ? (
          <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
            계정 삭제하기
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="del-confirm">
                확인을 위해 <span className="font-mono">{email}</span> 를 입력하세요
              </Label>
              <Input
                id="del-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                placeholder={email}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                취소
              </Button>
              <Button
                onClick={remove}
                disabled={pending || confirm.trim().toLowerCase() !== email.toLowerCase()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                영구 삭제
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
