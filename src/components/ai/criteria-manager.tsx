"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { addCriterion, deleteCriterion } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CRITERIA_SOURCES, type CriteriaSource } from "@/lib/constants";
import type { CriteriaRow } from "@/lib/db";

/** 평가 기준 목록 + 직접 추가/삭제 */
export function CriteriaManager({
  activityId,
  criteria,
}: {
  activityId: string;
  criteria: CriteriaRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await addCriterion(activityId, {
      name: String(form.get("name") ?? ""),
      weight: Number(form.get("weight") ?? 0),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {criteria.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          아직 평가 기준이 없습니다. 공고문을 업로드한 뒤 &lsquo;평가 기준 추출&rsquo;을 실행하거나 직접
          추가하세요.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {criteria.map((criterion) => (
            <li
              key={criterion.id}
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{criterion.name}</span>
              <span className="text-xs text-muted-foreground">
                {CRITERIA_SOURCES[criterion.source as CriteriaSource] ?? criterion.source}
              </span>
              <Badge variant="secondary">{criterion.weight}점</Badge>
              <button
                type="button"
                onClick={async () => {
                  await deleteCriterion(criterion.id);
                  router.refresh();
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`${criterion.name} 삭제`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li className="px-3 text-right text-xs text-muted-foreground">
            배점 합계: <span className="font-semibold text-foreground">{totalWeight}점</span>
          </li>
        </ul>
      )}

      <form ref={formRef} onSubmit={handleAdd} className="flex items-center gap-2">
        <Input name="name" placeholder="기준명 (예: 아이디어)" required maxLength={100} className="h-8" />
        <Input
          name="weight"
          type="number"
          placeholder="배점"
          required
          min={0}
          max={1000}
          step="any"
          className="h-8 w-24"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          추가
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
