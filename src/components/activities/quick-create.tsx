"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, ClipboardPaste, Loader2, Wand2, Check } from "lucide-react";
import { quickCreateActivity } from "@/actions/quick-create";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * 링크나 공고문 한 덩어리로 활동을 만든다.
 * 손으로 채워야 할 항목이 많다는 문제를 없애는 것이 목적이라, 성공하면
 * 무엇이 자동으로 채워졌는지 그대로 보여주고 활동 상세로 넘어간다.
 */
export function QuickCreate() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"url" | "text">("url");
  const [url, setUrl] = React.useState("");
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filled, setFilled] = React.useState<string[] | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setFilled(null);
    const result = await quickCreateActivity(mode === "url" ? { url } : { text });
    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "가져오지 못했습니다.");
      return;
    }
    setFilled(result.filled ?? []);
    // 무엇이 채워졌는지 잠깐 보여준 뒤 이동
    setTimeout(() => router.push(`/activities/${result.activityId}`), 1200);
  }

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-accent/50 to-card">
      <CardContent className="space-y-3 p-5">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <Wand2 className="h-4 w-4 text-primary" /> 공고 링크나 공고문으로 한 번에 등록
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            활동명·주최·마감일·평가 기준·제출물을 읽어서 대신 채웁니다. 아래에서 직접 입력할
            수도 있어요.
          </p>
        </div>

        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={mode === "url" ? "default" : "outline"}
            onClick={() => setMode("url")}
          >
            <Link2 className="h-4 w-4" /> 링크
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "text" ? "default" : "outline"}
            onClick={() => setMode("text")}
          >
            <ClipboardPaste className="h-4 w-4" /> 공고문 붙여넣기
          </Button>
        </div>

        {mode === "url" ? (
          <div className="space-y-1.5">
            <Label htmlFor="quick-url">공고 주소</Label>
            <Input
              id="quick-url"
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="quick-text">공고문 내용</Label>
            <Textarea
              id="quick-text"
              rows={6}
              placeholder="공고 페이지 내용을 복사해 붙여넣으세요. (모집 기간, 자격, 제출물, 심사 기준이 들어있으면 좋습니다)"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        {filled && (
          <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs">
            <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> 자동으로 채웠습니다
            </p>
            <p className="mt-1 text-muted-foreground">{filled.join(" · ")}</p>
          </div>
        )}

        <Button
          className={cn("w-full")}
          disabled={pending || (mode === "url" ? url.trim().length < 8 : text.trim().length < 50)}
          onClick={run}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {pending ? "공고를 읽는 중…" : "자동으로 활동 만들기"}
        </Button>
      </CardContent>
    </Card>
  );
}
