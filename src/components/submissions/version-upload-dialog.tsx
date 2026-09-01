"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { uploadSubmissionVersion } from "@/actions/submissions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VersionUploadDialog({
  submissionId,
  final: isFinalDefault,
}: {
  submissionId: string;
  final?: boolean;
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
    form.set("submissionId", submissionId);
    const result = await uploadSubmissionVersion(form);
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
      <Button
        size="sm"
        variant={isFinalDefault ? "default" : "outline"}
        onClick={() => setOpen(true)}
      >
        <Upload className="h-4 w-4" />
        {isFinalDefault ? "Final 업로드" : "버전 업로드"}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isFinalDefault ? "Final 파일 업로드" : "새 버전 업로드"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ver-file">파일 *</Label>
            <Input id="ver-file" name="file" type="file" required />
            <p className="text-xs text-muted-foreground">
              PDF/DOCX/PPTX/TXT 파일은 업로드 시 텍스트를 추출해 AI 평가에 사용합니다.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ver-note">버전 메모</Label>
            <Input
              id="ver-note"
              name="note"
              maxLength={300}
              placeholder="예: 사용자 인터뷰 결과 반영"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isFinal"
              value="true"
              defaultChecked={isFinalDefault}
              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
            />
            최종본(Final)으로 표시
          </label>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              업로드
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
