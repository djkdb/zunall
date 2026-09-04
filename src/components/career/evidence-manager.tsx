"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, Download } from "lucide-react";
import { addEvidence, deleteEvidence, importActivityEvidence } from "@/actions/career";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVIDENCE_KINDS } from "@/lib/career-constants";

export function AddEvidenceDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await addEvidence({
      kind: String(form.get("kind") ?? "project"),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      url: String(form.get("url") ?? ""),
      skillsText: String(form.get("skillsText") ?? ""),
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> 근거 추가
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="근거가 되는 경험 추가">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-kind">종류</Label>
              <Select id="ev-kind" name="kind" defaultValue="project">
                {Object.entries(EVIDENCE_KINDS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="ev-title">제목 *</Label>
              <Input id="ev-title" name="title" required maxLength={150} placeholder="예: Asteron — 3D 웹 프로젝트" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-skills">이 근거가 증명하는 스킬 (쉼표 구분) *</Label>
            <Input id="ev-skills" name="skillsText" required placeholder="예: Frontend, AI 활용" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-url">링크</Label>
            <Input id="ev-url" name="url" type="url" placeholder="https://github.com/…" maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">설명</Label>
            <Textarea id="ev-desc" name="description" rows={2} placeholder="무엇을 했고 어떤 결과가 있었는지" />
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

export function ImportEvidenceButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMessage(null);
          const result = await importActivityEvidence();
          setPending(false);
          setMessage(result.ok ? "활동에서 근거를 가져왔습니다." : result.error);
          router.refresh();
        }}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        활동에서 가져오기
      </Button>
      {message && <span className="mt-0.5 text-[10px] text-muted-foreground">{message}</span>}
    </span>
  );
}

export function DeleteEvidenceButton({ evidenceId }: { evidenceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="iconSm"
      disabled={pending}
      aria-label="근거 삭제"
      onClick={() => {
        if (!window.confirm("이 근거를 삭제할까요? 관련 스킬 점수가 낮아질 수 있습니다.")) return;
        startTransition(async () => {
          await deleteEvidence(evidenceId);
          router.refresh();
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  );
}
