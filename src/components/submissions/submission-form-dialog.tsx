"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil } from "lucide-react";
import { createSubmission, updateSubmission } from "@/actions/submissions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SUBMISSION_STATUSES } from "@/lib/constants";
import type { SubmissionRow } from "@/lib/db";

export function SubmissionFormDialog({
  activityId,
  submission,
  triggerVariant = "button",
}: {
  activityId: string;
  submission?: SubmissionRow;
  triggerVariant?: "button" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isEdit = !!submission;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const input = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      status: String(form.get("status") ?? "draft"),
      dueDate: String(form.get("dueDate") ?? ""),
    };
    const result = isEdit
      ? await updateSubmission(submission.id, input)
      : await createSubmission(activityId, input);
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
      {triggerVariant === "button" ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> 제출물 추가
        </Button>
      ) : (
        <Button variant="ghost" size="iconSm" onClick={() => setOpen(true)} aria-label="제출물 수정">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "제출물 수정" : "제출물 추가"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sub-title">이름 *</Label>
            <Input
              id="sub-title"
              name="title"
              required
              maxLength={120}
              defaultValue={submission?.title ?? ""}
              placeholder="예: 기획서, 최종 결과물, 발표자료"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-due">제출 마감일</Label>
              <Input id="sub-due" name="dueDate" type="date" defaultValue={submission?.dueDate ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-status">상태</Label>
              <Select id="sub-status" name="status" defaultValue={submission?.status ?? "draft"}>
                {Object.entries(SUBMISSION_STATUSES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-desc">설명</Label>
            <Textarea
              id="sub-desc"
              name="description"
              rows={2}
              defaultValue={submission?.description ?? ""}
              placeholder="어떤 결과물인지, 요구 형식은 무엇인지 메모"
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
              {isEdit ? "저장" : "추가"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
