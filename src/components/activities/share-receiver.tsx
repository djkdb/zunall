"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Share2, Sparkles } from "lucide-react";
import { quickCreateActivity } from "@/actions/quick-create";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

/** 공유된 텍스트 안에 링크가 섞여 오는 경우가 많아 첫 주소를 뽑아 쓴다 */
function firstUrl(...candidates: string[]): string {
  for (const value of candidates) {
    const match = value.match(/https?:\/\/[^\s]+/);
    if (match) return match[0];
  }
  return "";
}

/**
 * 공유로 넘어온 공고를 활동으로 만든다.
 * 주소가 있으면 그것으로, 없으면 공유된 글 자체를 공고문으로 쓴다.
 */
export function ShareReceiver({
  sharedUrl,
  sharedText,
  sharedTitle,
}: {
  sharedUrl: string;
  sharedText: string;
  sharedTitle: string;
}) {
  const router = useRouter();
  const [url, setUrl] = React.useState(sharedUrl || firstUrl(sharedText, sharedTitle));
  const [text, setText] = React.useState(sharedText);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasInput = url.trim().length > 0 || text.trim().length > 30;

  async function create() {
    setPending(true);
    setError(null);
    const result = await quickCreateActivity(
      url.trim() ? { url: url.trim() } : { text: text.trim() },
    );
    if (!result.ok || !result.activityId) {
      setPending(false);
      setError(result.error ?? "등록하지 못했습니다.");
      return;
    }
    router.replace(`/activities/${result.activityId}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Share2 className="h-5 w-5 text-primary" />
          공유한 공고 등록
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          내용을 확인하고 등록하면 마감일·자격·제출물·평가 기준까지 자동으로 채웁니다.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="share-url">공고 주소</Label>
            <Input
              id="share-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {!url.trim() && (
            <div className="space-y-1.5">
              <Label htmlFor="share-text">공고문</Label>
              <Textarea
                id="share-text"
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="주소가 없으면 공고문을 그대로 붙여넣어도 됩니다."
              />
            </div>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button onClick={create} disabled={pending || !hasInput} className="flex-1">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              자동으로 활동 만들기
            </Button>
            <Link href="/activities">
              <Button variant="outline" disabled={pending}>
                취소
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
