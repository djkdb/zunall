"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { addSkill, removeSkill } from "@/actions/career";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SKILL_CATALOG, STUDY_FIELDS, type StudyField } from "@/lib/career-constants";
import { cn } from "@/lib/utils";
import type { UserSkillRow } from "@/lib/db";

/**
 * 스킬 추가/삭제 관리자: 카탈로그 칩 + 직접 입력.
 * 전공 계열이 있으면 그 계열에서 쓰이는 스킬만 먼저 보여준다
 * (48개를 한꺼번에 보여주면 자기 전공과 무관한 항목에 묻힌다).
 */
export function SkillManager({
  skills,
  studyField = null,
}: {
  skills: UserSkillRow[];
  studyField?: StudyField | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const owned = new Set(skills.map((s) => s.name));
  const suggestions = SKILL_CATALOG.filter(
    (s) =>
      !owned.has(s.name) &&
      (showAll ||
        !studyField ||
        !s.fields ||
        s.fields.length === 0 ||
        s.fields.includes(studyField)),
  );

  async function handleAdd(name: string) {
    setPending(name);
    setError(null);
    const result = await addSkill(name);
    setPending(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  async function handleRemove(id: string, name: string) {
    setPending(name);
    const result = await removeSkill(id);
    setPending(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span
              key={skill.id}
              className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {skill.name}
              <button
                type="button"
                aria-label={`${skill.name} 삭제`}
                onClick={() => handleRemove(skill.id, skill.name)}
                className="rounded-full p-0.5 hover:bg-primary/20"
                disabled={pending !== null}
              >
                {pending === skill.name ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </button>
            </span>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">추가할 수 있는 스킬</p>
            {studyField && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll
                  ? `${STUDY_FIELDS[studyField]} 계열만 보기`
                  : `${STUDY_FIELDS[studyField]} 계열 기준 — 전체 보기`}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((skill) => (
              <button
                key={skill.name}
                type="button"
                onClick={() => handleAdd(skill.name)}
                disabled={pending !== null}
                className={cn(
                  "rounded-full border border-input px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
                  pending === skill.name && "opacity-50",
                )}
              >
                + {skill.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={async (e) => {
          e.preventDefault();
          const input = new FormData(e.currentTarget).get("name");
          const name = String(input ?? "").trim();
          if (!name) return;
          await handleAdd(name);
          formRef.current?.reset();
        }}
        className="flex items-center gap-2"
      >
        <Input name="name" placeholder="직접 입력 (예: Unity)" maxLength={30} className="h-8" />
        <Button type="submit" size="sm" variant="outline" disabled={pending !== null}>
          <Plus className="h-4 w-4" /> 추가
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
