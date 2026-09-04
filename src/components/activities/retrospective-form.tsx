"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Save } from "lucide-react";
import { saveRetrospective } from "@/actions/retrospective";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Retro {
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  learned: string | null;
  skills: string | null;
}

const FIELDS: Array<{ name: keyof Retro; label: string; hint: string; rows: number }> = [
  { name: "situation", label: "S · 상황", hint: "어떤 상황이었나요? (배경, 문제)", rows: 2 },
  { name: "task", label: "T · 과제", hint: "내가 맡은 역할과 목표는 무엇이었나요?", rows: 2 },
  { name: "action", label: "A · 행동", hint: "구체적으로 무엇을 어떻게 했나요?", rows: 4 },
  { name: "result", label: "R · 결과", hint: "결과는? 가능하면 숫자로 (예: 이탈률 12%→5%)", rows: 2 },
  { name: "learned", label: "배운 점", hint: "다음에 다르게 할 것 한 가지", rows: 2 },
];

/**
 * 활동 회고 (STAR).
 * 자소서 문항 대부분이 이 구조를 요구하므로, 끝난 활동을 이 형식으로 남겨두면
 * 나중에 그대로 재료가 된다. 적어둔 스킬은 커리어 근거로도 등록된다.
 */
export function RetrospectiveForm({
  activityId,
  retro,
}: {
  activityId: string;
  retro: Retro | null;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = React.useState<string | null>(null);

  const skills: string[] = retro?.skills ? (JSON.parse(retro.skills) as string[]) : [];

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        setError(null);
        const form = new FormData(e.currentTarget);
        form.set("activityId", activityId);
        const result = await saveRetrospective(form);
        if (!result.ok) {
          setState("idle");
          setError(result.error);
          return;
        }
        setState("saved");
        router.refresh();
        setTimeout(() => setState("idle"), 2000);
      }}
    >
      <p className="text-xs text-muted-foreground">
        자기소개서가 요구하는 구조 그대로입니다. 활동이 끝난 직후에 적어두면 나중에 문항이
        무엇이든 재료로 쓸 수 있습니다.
      </p>

      {FIELDS.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={`retro-${field.name}`}>{field.label}</Label>
          <Textarea
            id={`retro-${field.name}`}
            name={field.name}
            rows={field.rows}
            placeholder={field.hint}
            defaultValue={retro?.[field.name] ?? ""}
          />
        </div>
      ))}

      <div className="space-y-1.5">
        <Label htmlFor="retro-skills">이 활동으로 증명한 스킬 (쉼표 구분)</Label>
        <Input
          id="retro-skills"
          name="skillsText"
          placeholder="예: 데이터 분석, 협업, 기획"
          defaultValue={skills.join(", ")}
        />
        <p className="text-xs text-muted-foreground">
          여기 적은 스킬은 커리어 근거로도 등록되어 커리어 점수에 반영됩니다.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      <Button type="submit" size="sm" disabled={state === "saving"}>
        {state === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
        {state === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {state === "saved" ? "저장됨" : "회고 저장"}
      </Button>
    </form>
  );
}
