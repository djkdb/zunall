"use client";

import * as React from "react";
import { CalendarPlus, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { issueCalendarToken } from "@/actions/calendar";
import { Button } from "@/components/ui/button";

/**
 * 구글/애플 캘린더 구독 주소 안내.
 * 주소를 만들기 전에는 아무 토큰도 발급하지 않는다(원치 않는 공개 주소 방지).
 */
export function CalendarSubscribeCard({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = React.useState(initialToken);
  const [pending, setPending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/calendar/${token}.ics` : "";

  async function create(regenerate = false) {
    setPending(true);
    setToken(await issueCalendarToken(regenerate));
    setPending(false);
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <CalendarPlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium">구글·애플 캘린더에서 보기</p>
            <p className="text-xs text-muted-foreground">
              마감일과 일정이 내 캘린더에 자동으로 나타납니다. 앱에서 일정을 바꾸면 몇 시간 안에
              반영됩니다.
            </p>
          </div>

          {token ? (
            <>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1.5 text-xs">
                  {url}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "복사됨" : "복사"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                구글 캘린더 → 다른 캘린더 <strong>+</strong> → <strong>URL로 추가</strong> 에 붙여넣으세요.
                이 주소를 아는 사람은 내 일정을 볼 수 있으니 공유하지 마세요.
              </p>
              <div className="flex gap-2">
                <a href={url} download="cavero.ics">
                  <Button size="sm" variant="outline">
                    .ics 파일로 내려받기
                  </Button>
                </a>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => create(true)}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  주소 새로 만들기
                </Button>
              </div>
            </>
          ) : (
            <Button size="sm" disabled={pending} onClick={() => create(false)}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              구독 주소 만들기
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
