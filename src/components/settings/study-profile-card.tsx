"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { saveStudyProfile } from "@/actions/career";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STUDY_FIELDS, ROLE_TEMPLATES, type StudyField } from "@/lib/career-constants";
import { templatesForField } from "@/services/career/templates";
import { cn } from "@/lib/utils";

/**
 * 전공 계열·학과·희망 직무를 언제든 바꾸는 카드.
 * 이 값이 스킬 추천, Career Score 기준(역할 템플릿), 활동 추천을 결정한다.
 */
export function StudyProfileCard({
  initialField,
  initialMajor,
  initialRoleKey,
}: {
  initialField: StudyField | null;
  initialMajor: string | null;
  initialRoleKey: string | null;
}) {
  const router = useRouter();
  const [field, setField] = React.useState<StudyField | null>(initialField);
  const [roleKey, setRoleKey] = React.useState<string | null>(initialRoleKey);
  const [major, setMajor] = React.useState(initialMajor ?? "");
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    const result = await saveStudyProfile({ studyField: field, major, roleKey });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>전공 · 희망 직무</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          여기서 고른 기준으로 스킬 추천, Career Score 기준 역량, 추천 활동이 달라집니다.
        </p>

        <div className="space-y-1.5">
          <Label>전공 계열</Label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STUDY_FIELDS) as StudyField[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  const next = field === key ? null : key;
                  setField(next);
                  setRoleKey((current) => {
                    const picked = ROLE_TEMPLATES.find((t) => t.key === current);
                    return picked && next && picked.field !== next ? null : current;
                  });
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  field === key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {STUDY_FIELDS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="set-major">학과 / 학부</Label>
          <Input
            id="set-major"
            value={major}
            maxLength={60}
            placeholder="예: 경영학과, 기계공학부"
            onChange={(e) => setMajor(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>희망 직무</Label>
          <div className="flex flex-wrap gap-1.5">
            {templatesForField(field)
              .filter((t) => t.key !== "general")
              .map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => setRoleKey(roleKey === template.key ? null : template.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    roleKey === template.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {template.label}
                </button>
              ))}
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button onClick={save} disabled={pending} className="w-full sm:w-auto">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? "저장했습니다" : "저장"}
        </Button>
      </CardContent>
    </Card>
  );
}
