"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Wand2, Trash2, ListPlus, Check } from "lucide-react";
import {
  addRoadmapItem,
  generateRoadmap,
  deleteRoadmapItem,
  setRoadmapStatus,
  roadmapItemToTask,
} from "@/actions/career";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ROADMAP_STATUSES } from "@/lib/career-constants";

export function GenerateRoadmapButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMessage(null);
          const result = await generateRoadmap();
          setPending(false);
          if (!result.ok) setMessage(result.error);
          router.refresh();
        }}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        Gap 기반 자동 생성
      </Button>
      {message && <span className="mt-0.5 text-[10px] text-destructive">{message}</span>}
    </span>
  );
}

export function AddRoadmapItemDialog({ defaultMonth }: { defaultMonth: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await addRoadmapItem({
      month: String(form.get("month") ?? ""),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> 항목 추가
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="로드맵 항목 추가">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rm-month">월</Label>
              <Input id="rm-month" name="month" type="month" required defaultValue={defaultMonth} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="rm-title">할 일 *</Label>
              <Input id="rm-title" name="title" required maxLength={200} placeholder="예: AI 프로젝트 배포" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rm-desc">설명</Label>
            <Textarea id="rm-desc" name="description" rows={2} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
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

export function RoadmapItemControls({
  itemId,
  status,
  hasTask,
}: {
  itemId: string;
  status: string;
  hasTask: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [taskState, setTaskState] = React.useState<"idle" | "done">("idle");

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Select
        value={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setRoadmapStatus(itemId, next);
            router.refresh();
          });
        }}
        className="h-7 w-auto text-xs"
        aria-label="로드맵 상태"
      >
        {Object.entries(ROADMAP_STATUSES).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
      {!hasTask && taskState === "idle" ? (
        <Button
          variant="ghost"
          size="iconSm"
          disabled={pending}
          title="Task로 등록"
          aria-label="Task로 등록"
          onClick={() =>
            startTransition(async () => {
              const result = await roadmapItemToTask(itemId);
              if (result.ok) setTaskState("done");
              router.refresh();
            })
          }
        >
          <ListPlus className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <span title="Task 연결됨" className="px-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        </span>
      )}
      <Button
        variant="ghost"
        size="iconSm"
        disabled={pending}
        aria-label="삭제"
        onClick={() =>
          startTransition(async () => {
            await deleteRoadmapItem(itemId);
            router.refresh();
          })
        }
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}
