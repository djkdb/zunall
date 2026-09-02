"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Upload, Check, X } from "lucide-react";
import {
  analyzeProfileFile,
  analyzeProfileText,
  saveProfileImport,
} from "@/actions/profile-import";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Extracted {
  headline: string;
  summary: string;
  skills: string[];
  evidence: Array<{ title: string; description: string; skills: string[]; kind: string }>;
}

const KIND_LABELS: Record<string, string> = {
  activity: "대외활동",
  project: "프로젝트",
  award: "수상",
  certificate: "자격증",
  education: "교육",
  work: "경력",
};

/**
 * 이력·자기소개를 붙여넣거나 파일로 올리면 스킬과 근거를 뽑아준다.
 * 정보를 조금밖에 안 넣어 점수가 부정확한 문제를 해결하는 입구다.
 * AI 가 임의로 경력을 만들지 않도록, 뽑은 항목을 사용자가 고른 뒤에만 저장한다.
 */
export function ProfileImport() {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Extracted | null>(null);
  const [chosenSkills, setChosenSkills] = React.useState<Set<string>>(new Set());
  const [chosenEvidence, setChosenEvidence] = React.useState<Set<number>>(new Set());
  const [saved, setSaved] = React.useState<string | null>(null);

  function receive(result: { ok: boolean; error?: string; data?: Extracted }) {
    setPending(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "분석에 실패했습니다.");
      return;
    }
    setData(result.data);
    setChosenSkills(new Set(result.data.skills));
    setChosenEvidence(new Set(result.data.evidence.map((_, index) => index)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" /> 내 이력으로 한 번에 채우기
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          이력서·자기소개서·수상 내역을 붙여넣거나 파일로 올리면 스킬과 근거를 뽑아드립니다.
          <strong> 고른 것만 저장</strong>되고, 저장한 만큼 Career Score의 근거가 됩니다.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {!data && (
          <>
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"예)\n2025 교내 데이터 분석 공모전 대상 — 파이썬으로 3년치 지원서 분석\n2024 마케팅 서포터즈 3기 — 인스타 콘텐츠 월 8회 제작\nADsP 자격증 취득 / TOEIC 900"}
              aria-label="이력 붙여넣기"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={pending || text.replace(/\s/g, "").length < 50}
                onClick={async () => {
                  setPending(true);
                  setError(null);
                  receive(await analyzeProfileText(text));
                }}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                붙여넣은 글에서 뽑기
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> 이력서 파일에서 뽑기
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.pptx,.txt,.md"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setPending(true);
                  setError(null);
                  const form = new FormData();
                  form.set("file", file);
                  receive(await analyzeProfileFile(form));
                }}
              />
            </div>
          </>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}
        {saved && (
          <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
            {saved}
          </p>
        )}

        {data && (
          <div className="space-y-3">
            {data.headline && (
              <div className="rounded-md bg-secondary/50 p-3 text-sm">
                <p className="font-medium">{data.headline}</p>
                {data.summary && <p className="mt-1 text-xs text-muted-foreground">{data.summary}</p>}
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                찾은 스킬 — 넣을 것만 남기세요
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.skills.length === 0 && (
                  <span className="text-xs text-muted-foreground">찾은 스킬이 없습니다.</span>
                )}
                {data.skills.map((skill) => {
                  const on = chosenSkills.has(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() =>
                        setChosenSkills((prev) => {
                          const next = new Set(prev);
                          if (next.has(skill)) next.delete(skill);
                          else next.add(skill);
                          return next;
                        })
                      }
                    >
                      <Badge variant={on ? "default" : "outline"}>
                        {on ? <Check className="mr-1 h-3 w-3" /> : <X className="mr-1 h-3 w-3" />}
                        {skill}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                찾은 근거 {data.evidence.length}건
              </p>
              <ul className="space-y-1.5">
                {data.evidence.map((item, index) => {
                  const on = chosenEvidence.has(index);
                  return (
                    <li key={index}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs hover:bg-accent">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                          checked={on}
                          onChange={() =>
                            setChosenEvidence((prev) => {
                              const next = new Set(prev);
                              if (next.has(index)) next.delete(index);
                              else next.add(index);
                              return next;
                            })
                          }
                        />
                        <span className="min-w-0">
                          <span className="font-medium">{item.title}</span>{" "}
                          <Badge variant="secondary" className="ml-1 text-[10px]">
                            {KIND_LABELS[item.kind] ?? item.kind}
                          </Badge>
                          {item.description && (
                            <span className="mt-0.5 block text-muted-foreground">{item.description}</span>
                          )}
                          {item.skills.length > 0 && (
                            <span className="mt-0.5 block text-muted-foreground">
                              {item.skills.map((s) => `#${s}`).join(" ")}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setData(null)} disabled={pending}>
                다시 붙여넣기
              </Button>
              <Button
                size="sm"
                disabled={pending || (chosenSkills.size === 0 && chosenEvidence.size === 0)}
                onClick={async () => {
                  setPending(true);
                  const result = await saveProfileImport({
                    headline: data.headline,
                    summary: data.summary,
                    skills: [...chosenSkills],
                    evidence: data.evidence.filter((_, index) => chosenEvidence.has(index)),
                  });
                  setPending(false);
                  if (!result.ok) {
                    setError(result.error ?? "저장에 실패했습니다.");
                    return;
                  }
                  setSaved(
                    `저장했습니다 — 스킬 ${result.added.skills}개, 근거 ${result.added.evidence}건이 추가되어 점수에 반영됩니다.`,
                  );
                  setData(null);
                  setText("");
                  router.refresh();
                }}
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                고른 항목 저장
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
