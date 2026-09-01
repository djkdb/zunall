"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil } from "lucide-react";
import { createEvent, updateEvent } from "@/actions/events";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_TYPES } from "@/lib/constants";
import type { EventRow } from "@/lib/db";

export function EventFormDialog({
  activityId,
  activityOptions,
  event,
  defaultDate,
  triggerVariant = "button",
}: {
  /** 활동 상세에서 열 때: 해당 활동으로 고정 */
  activityId?: string | null;
  /** 전역 캘린더에서 열 때: 활동 선택 목록 */
  activityOptions?: Array<{ id: string; name: string }>;
  event?: EventRow;
  defaultDate?: string;
  triggerVariant?: "button" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isEdit = !!event;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const input = {
      title: String(form.get("title") ?? ""),
      type: String(form.get("type") ?? "etc"),
      date: String(form.get("date") ?? ""),
      time: String(form.get("time") ?? ""),
      endDate: String(form.get("endDate") ?? ""),
      memo: String(form.get("memo") ?? ""),
      activityId: activityId ?? String(form.get("activityId") ?? "") ?? undefined,
    };
    const result = isEdit ? await updateEvent(event.id, input) : await createEvent(input);
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
          <Plus className="h-4 w-4" /> 일정 추가
        </Button>
      ) : (
        <Button variant="ghost" size="iconSm" onClick={() => setOpen(true)} aria-label="일정 수정">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={isEdit ? "일정 수정" : "일정 추가"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">제목 *</Label>
            <Input
              id="ev-title"
              name="title"
              required
              maxLength={120}
              defaultValue={event?.title ?? ""}
              placeholder="예: 중간 결과물 제출"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-type">일정 유형</Label>
              <Select id="ev-type" name="type" defaultValue={event?.type ?? "etc"}>
                {Object.entries(EVENT_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            {!activityId && activityOptions && (
              <div className="space-y-1.5">
                <Label htmlFor="ev-activity">활동</Label>
                <Select id="ev-activity" name="activityId" defaultValue={event?.activityId ?? ""}>
                  <option value="">활동 없음 (일반 일정)</option>
                  {activityOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">날짜 *</Label>
              <Input
                id="ev-date"
                name="date"
                type="date"
                required
                defaultValue={event?.date ?? defaultDate ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-time">시간</Label>
              <Input id="ev-time" name="time" type="time" defaultValue={event?.time ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-end">종료일</Label>
              <Input id="ev-end" name="endDate" type="date" defaultValue={event?.endDate ?? ""} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-memo">메모</Label>
            <Textarea id="ev-memo" name="memo" rows={2} defaultValue={event?.memo ?? ""} />
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
