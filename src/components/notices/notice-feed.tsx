"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, RefreshCw, Rss, Trash2, ExternalLink, X, Pause, Play, TriangleAlert,
} from "lucide-react";
import {
  addNoticeSource, checkNoticeSource, deleteNoticeSource,
  toggleNoticeSource, dismissNoticeItem, addNoticeAsActivity,
} from "@/actions/notices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, relativeTime } from "@/lib/utils";
import type { NoticeSourceRow, NoticeItemRow } from "@/lib/db";

/**
 * 공고 자동 수집 화면.
 * 관심 사이트를 등록해두면 하루 한 번 새 글을 찾아 여기에 모아준다.
 */
export function NoticeFeed({ sources, items }: { sources: NoticeSourceRow[]; items: NoticeItemRow[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(sources.length === 0);
  const formRef = React.useRef<HTMLFormElement>(null);

  const sourceName = new Map(sources.map((s) => [s.id, s.name]));

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string; found?: number }>) {
    setPending(key);
    setError(null);
    setNotice(null);
    const result = await fn();
    setPending(null);
    if (!result.ok) return setError(result.error ?? "처리하지 못했습니다.");
    if (typeof result.found === "number") {
      setNotice(result.found > 0 ? `새 공고 ${result.found}건을 찾았습니다.` : "새로 올라온 공고가 없습니다.");
    }
    router.refresh();
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await run("add", () =>
      addNoticeSource({
        name: String(form.get("name") ?? ""),
        url: String(form.get("url") ?? ""),
        keywords: String(form.get("keywords") ?? ""),
      }),
    );
    formRef.current?.reset();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Rss className="h-4 w-4 text-primary" />
              관심 사이트 {sources.length > 0 && `(${sources.length})`}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              공고 목록 페이지나 RSS 주소를 등록해두면 하루 한 번 새 글을 찾아옵니다.
            </p>
          </div>
          <div className="flex gap-1.5">
            {sources.length > 0 && (
              <Button size="sm" variant="outline" disabled={pending !== null}
                onClick={() => run("check-all", () => checkNoticeSource())}>
                {pending === "check-all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                지금 확인
              </Button>
            )}
            <Button size="sm" variant={showForm ? "outline" : "default"} onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" /> 사이트 추가
            </Button>
          </div>
        </div>

        {showForm && (
          <form ref={formRef} onSubmit={submit} className="mt-3 space-y-3 rounded-md bg-secondary/50 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ns-name">이름</Label>
                <Input id="ns-name" name="name" required maxLength={60} placeholder="예: 링커리어 공모전" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ns-keywords">키워드 (선택)</Label>
                <Input id="ns-keywords" name="keywords" maxLength={200} placeholder="예: 마케팅, 공모전" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-url">공고 목록 주소</Label>
              <Input id="ns-url" name="url" required placeholder="https://example.com/notices" />
              <p className="text-xs text-muted-foreground">
                공고가 여러 개 나열된 페이지 주소를 넣으세요. RSS 주소도 됩니다. 로그인이 필요한
                페이지는 가져올 수 없습니다.
              </p>
            </div>
            <Button type="submit" size="sm" disabled={pending !== null}>
              {pending === "add" && <Loader2 className="h-4 w-4 animate-spin" />}
              등록하고 지금 확인
            </Button>
          </form>
        )}

        {error && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        {notice && (
          <p className="mt-3 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            {notice}
          </p>
        )}

        {sources.length > 0 && (
          <ul className="mt-3 divide-y border-t">
            {sources.map((source) => (
              <li key={source.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className={cn("font-medium", source.active === 0 && "text-muted-foreground line-through")}>
                  {source.name}
                </span>
                <a href={source.url} target="_blank" rel="noreferrer noopener"
                  aria-label={`${source.name} 사이트 열기`}
                  className="text-xs text-muted-foreground hover:text-foreground">
                  <ExternalLink className="inline h-3 w-3" />
                </a>
                {source.keywords && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                    {source.keywords}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {source.lastCheckedAt ? `${relativeTime(source.lastCheckedAt)} 확인` : "확인 전"}
                </span>
                {source.lastError && (
                  <span className="flex items-center gap-1 text-xs text-destructive" title={source.lastError}>
                    <TriangleAlert className="h-3 w-3" />
                    {source.lastError}
                  </span>
                )}
                <span className="ml-auto flex gap-1">
                  <IconButton label="지금 확인" busy={pending === `check-${source.id}`} disabled={pending !== null}
                    onClick={() => run(`check-${source.id}`, () => checkNoticeSource(source.id))}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label={source.active === 1 ? "일시 중지" : "다시 켜기"}
                    busy={pending === `toggle-${source.id}`} disabled={pending !== null}
                    onClick={() => run(`toggle-${source.id}`, () => toggleNoticeSource(source.id))}>
                    {source.active === 1 ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </IconButton>
                  <IconButton label="삭제" busy={pending === `del-${source.id}`} disabled={pending !== null}
                    onClick={() => run(`del-${source.id}`, () => deleteNoticeSource(source.id))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          새로 올라온 공고 {items.length > 0 && `(${items.length})`}
        </h2>

        {items.length === 0 ? (
          <EmptyState
            icon={Rss}
            title={sources.length === 0 ? "아직 등록한 사이트가 없습니다" : "새 공고가 없습니다"}
            description={
              sources.length === 0
                ? "자주 보는 공고 사이트를 등록해두면 새 글이 올라올 때 여기에 모입니다."
                : "다음 확인 때 새 글이 있으면 여기에 표시됩니다."
            }
          />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <a href={item.url} target="_blank" rel="noreferrer noopener"
                    className="text-sm font-medium hover:text-primary hover:underline">
                    {item.title}
                  </a>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {sourceName.get(item.sourceId) ?? "삭제된 사이트"}
                    {item.publishedAt ? ` · ${item.publishedAt}` : ""} · {relativeTime(item.foundAt)} 발견
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" disabled={pending !== null}
                    onClick={() => run(`add-${item.id}`, () => addNoticeAsActivity(item.id))}>
                    {pending === `add-${item.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    활동으로 등록
                  </Button>
                  <IconButton label="숨기기" busy={pending === `dismiss-${item.id}`} disabled={pending !== null}
                    onClick={() => run(`dismiss-${item.id}`, () => dismissNoticeItem(item.id))}>
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function IconButton({
  label, busy, disabled, onClick, children,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}
