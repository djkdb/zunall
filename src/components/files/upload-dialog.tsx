"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, FilePlus2 } from "lucide-react";
import { uploadDocument } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DOC_CATEGORIES } from "@/lib/constants";

export function UploadDialog({
  activityId,
  defaultCategory,
  groupId,
  triggerLabel,
  triggerVariant = "default",
}: {
  activityId: string;
  defaultCategory?: string;
  /** 지정 시 해당 문서의 새 버전 업로드 */
  groupId?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isVersion = !!groupId;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("activityId", activityId);
    if (groupId) form.set("groupId", groupId);
    const result = await uploadDocument(form);
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
        variant={triggerVariant}
        onClick={() => setOpen(true)}
      >
        {isVersion ? <FilePlus2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        {triggerLabel ?? (isVersion ? "새 버전" : "파일 업로드")}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isVersion ? "새 버전 업로드" : "파일 업로드"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="up-file">파일 *</Label>
            <Input id="up-file" name="file" type="file" required />
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, PPTX, XLSX, 이미지, ZIP, TXT 등 (최대 20MB). PDF/DOCX/PPTX/TXT는
              업로드 시 텍스트를 추출해 AI 분석에 사용합니다.
            </p>
          </div>

          {!isVersion && (
            <div className="space-y-1.5">
              <Label htmlFor="up-category">분류</Label>
              <Select id="up-category" name="category" defaultValue={defaultCategory ?? "reference"}>
                {Object.entries(DOC_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="up-desc">설명</Label>
            <Input
              id="up-desc"
              name="description"
              maxLength={500}
              placeholder={isVersion ? "이번 버전에서 바뀐 점" : "파일 설명 (선택)"}
            />
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
              업로드
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
