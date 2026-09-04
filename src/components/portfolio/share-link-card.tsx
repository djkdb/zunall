"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Check, RefreshCw, EyeOff, Loader2 } from "lucide-react";
import {
  issuePortfolioToken,
  regeneratePortfolioToken,
  disablePortfolioSharing,
} from "@/actions/portfolio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** 포트폴리오를 주소로 공유한다. 주소를 아는 사람만 볼 수 있다. */
export function ShareLinkCard({ token }: { token: string | null }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => setOrigin(window.location.origin), []);
  const url = token ? `${origin}/p/${token}` : "";

  async function run(key: string, fn: () => Promise<unknown>) {
    setPending(key);
    await fn();
    setPending(null);
    router.refresh();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드를 막아둔 브라우저에서는 주소를 직접 선택해 복사하면 된다
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-primary" />
            공유 링크
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {token
              ? "주소를 아는 사람만 볼 수 있습니다. 로그인은 필요 없고, 검색에는 걸리지 않습니다."
              : "링크를 만들면 지원서나 메일에 포트폴리오 주소를 첨부할 수 있습니다."}
          </p>
        </div>
        {!token && (
          <Button size="sm" disabled={pending !== null} onClick={() => run("issue", issuePortfolioToken)}>
            {pending === "issue" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            공유 링크 만들기
          </Button>
        )}
      </div>

      {token && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Input value={url} readOnly aria-label="포트폴리오 공유 주소" onFocus={(e) => e.currentTarget.select()} />
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "복사됨" : "복사"}
            </Button>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={pending !== null}
              onClick={() => run("regen", regeneratePortfolioToken)}
            >
              {pending === "regen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              주소 새로 만들기
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending !== null}
              onClick={() => run("off", disablePortfolioSharing)}
            >
              {pending === "off" ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
              공유 중지
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            주소를 새로 만들거나 중지하면 이전 주소로는 즉시 볼 수 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}
