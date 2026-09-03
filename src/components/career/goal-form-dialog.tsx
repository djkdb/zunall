"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Target, Loader2, Pencil } from "lucide-react";
import { saveGoal } from "@/actions/career";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GOAL_TYPES, GOAL_PRIORITIES } from "@/lib/career-constants";
import type { CareerGoalRow } from "@/lib/db";

export function GoalFormDialog({
  goal,
  goalRoles,
  goalCompanies,
}: {
  goal: CareerGoalRow | null;
  goalRoles: string[];
  goalCompanies: string[];
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
    const result = await saveGoal({
      type: (String(form.get("type")) as "ROLE") || "ROLE",
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      targetRolesText: String(form.get("targetRolesText") ?? ""),
      targetCompaniesText: String(form.get("targetCompaniesText") ?? ""),
      targetPeriod: String(form.get("targetPeriod") ?? ""),
      priority: (String(form.get("priority")) as "HIGH") || "HIGH",
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant={goal ? "ghost" : "default"} onClick={() => setOpen(true)}>
        {goal ? <Pencil className="h-3.5 w-3.5" /> : <Target className="h-4 w-4" />}
        {goal ? "목표 수정" : "목표 설정"}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="커리어 목표">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">목표 *</Label>
            <Input
              id="goal-name"
              name="name"
              required
              maxLength={120}
              defaultValue={goal?.name ?? ""}
              placeholder="예: 마케터, AI 엔지니어"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-type">유형</Label>
              <Select id="goal-type" name="type" defaultValue={goal?.type ?? "ROLE"}>
                {Object.entries(GOAL_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-priority">우선순위</Label>
              <Select id="goal-priority" name="priority" defaultValue={goal?.priority ?? "HIGH"}>
                {Object.entries(GOAL_PRIORITIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-period">목표 시기</Label>
              <Input
                id="goal-period"
                name="targetPeriod"
                maxLength={60}
                defaultValue={goal?.targetPeriod ?? ""}
                placeholder="2027 상반기"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-roles">희망 직무 (쉼표 구분)</Label>
            <Input
              id="goal-roles"
              name="targetRolesText"
              defaultValue={goalRoles.join(", ")}
              placeholder="AI 엔지니어, 백엔드 개발자"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-companies">희망 기업 (쉼표 구분)</Label>
            <Input
              id="goal-companies"
              name="targetCompaniesText"
              defaultValue={goalCompanies.join(", ")}
              placeholder="네이버, 토스"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-desc">메모</Label>
            <Textarea id="goal-desc" name="description" rows={2} defaultValue={goal?.description ?? ""} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              저장
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
