"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { addEssayQuestion } from "@/actions/essays";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function EssayQuestionForm({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        문항 추가
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="자기소개서 문항 추가">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            const form = new FormData(e.currentTarget);
            form.set("activityId", activityId);
            const result = await addEssayQuestion(form);
            setPending(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setOpen(false);
            router.refresh();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="essay-question">문항 *</Label>
            <Textarea
              id="essay-question"
              name="question"
              rows={3}
              required
              placeholder="예: 지원 동기와 입사 후 목표를 기술해주세요."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="essay-limit">글자수 제한</Label>
            <Input id="essay-limit" name="charLimit" type="number" min={50} placeholder="예: 800" />
            <p className="text-xs text-muted-foreground">비워두면 제한 없이 검토합니다.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="essay-guide">작성 가이드 (선택)</Label>
            <Input id="essay-guide" name="guide" placeholder="예: 경험 1개를 STAR 구조로" />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              추가
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
