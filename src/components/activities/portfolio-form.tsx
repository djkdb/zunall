"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Check } from "lucide-react";
import { updatePortfolio } from "@/actions/activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityRow } from "@/lib/db";

/** 종료된 활동을 포트폴리오 기록으로 남기는 폼 */
export function PortfolioForm({ activity }: { activity: ActivityRow }) {
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("saving");
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await updatePortfolio(activity.id, {
      role: String(form.get("role") ?? ""),
      achievement: String(form.get("achievement") ?? ""),
      learned: String(form.get("learned") ?? ""),
      skills: String(form.get("skills") ?? ""),
    });
    if (!result.ok) {
      setState("idle");
      setError(result.error);
      return;
    }
    setState("saved");
    router.refresh();
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pf-role">나의 역할</Label>
          <Input
            id="pf-role"
            name="role"
            defaultValue={activity.role ?? ""}
            placeholder="예: 팀장 / 기획 담당"
            maxLength={200}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-skills">사용 기술 / 도구</Label>
          <Input
            id="pf-skills"
            name="skills"
            defaultValue={activity.skills ?? ""}
            placeholder="예: Figma, React, 데이터 분석"
            maxLength={300}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-achievement">성과 / 결과</Label>
        <Textarea
          id="pf-achievement"
          name="achievement"
          rows={2}
          defaultValue={activity.achievement ?? ""}
          placeholder="예: 본선 진출, 우수상 수상, MVP 출시"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-learned">배운 점</Label>
        <Textarea
          id="pf-learned"
          name="learned"
          rows={3}
          defaultValue={activity.learned ?? ""}
          placeholder="이 활동을 통해 배운 것, 다음에 다르게 할 것"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={state === "saving"}>
          {state === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === "saved" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {state === "saved" ? "저장됨" : "기록 저장"}
        </Button>
      </div>
    </form>
  );
}
