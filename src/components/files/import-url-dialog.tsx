"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { importDocumentFromUrl } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DOC_CATEGORIES } from "@/lib/constants";

/** 공고 페이지 주소를 붙여넣어 본문을 문서로 가져온다 */
export function ImportUrlDialog({
  activityId,
  defaultCategory = "notice",
  triggerVariant = "outline",
}: {
  activityId: string;
  defaultCategory?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("activityId", activityId);
    const result = await importDocumentFromUrl(form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant={triggerVariant} onClick={() => setOpen(true)}>
        <Link2 className="h-4 w-4" />
        링크로 가져오기
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="공고 링크 가져오기">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="import-url">공고 주소 *</Label>
            <Input
              id="import-url"
              name="url"
              type="url"
              placeholder="https://…"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              공고 페이지 주소를 붙여넣으면 본문을 읽어 문서로 저장합니다. 저장한 뒤
              &lsquo;공고 분석&rsquo;을 누르면 마감일·자격·제출물을 뽑아냅니다. 로그인이 필요하거나
              자바스크립트로 그려지는 페이지는 읽지 못할 수 있어요.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-category">분류</Label>
            <Select id="import-category" name="category" defaultValue={defaultCategory}>
              {Object.entries(DOC_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              가져오기
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
