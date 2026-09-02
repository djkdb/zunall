"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Target, User, Wrench, Loader2, ArrowRight, Check } from "lucide-react";
import { saveGoal, saveProfileBasics, addSkill, completeOnboarding } from "@/actions/career";
import { CaveroMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GOAL_TYPES, SKILL_CATALOG } from "@/lib/career-constants";
import { cn } from "@/lib/utils";

/**
 * 신규 사용자 온보딩: 목표 → 프로필 → 스킬 선택 → 완료(근거 자동 임포트).
 * 완료하면 Career Score가 계산되기 시작한다.
 */
export function OnboardingWizard({ userName }: { userName: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = React.useState<Set<string>>(new Set());
  const [addedSkills, setAddedSkills] = React.useState<Set<string>>(new Set());

  const steps = [
    { icon: Target, label: "목표 설정" },
    { icon: User, label: "프로필" },
    { icon: Wrench, label: "스킬 선택" },
  ];

  async function submitGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await saveGoal({
      type: (form.get("type") as "ROLE") ?? "ROLE",
      name: String(form.get("name") ?? ""),
      targetRolesText: String(form.get("targetRolesText") ?? ""),
      targetCompaniesText: String(form.get("targetCompaniesText") ?? ""),
      targetPeriod: String(form.get("targetPeriod") ?? ""),
      priority: "HIGH",
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setStep(1);
  }

  async function submitProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await saveProfileBasics({
      headline: String(form.get("headline") ?? ""),
      summary: String(form.get("summary") ?? ""),
      githubUsername: String(form.get("githubUsername") ?? ""),
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setStep(2);
  }

  async function toggleSkill(name: string) {
    if (addedSkills.has(name)) return; // 이미 서버에 반영됨
    const next = new Set(selectedSkills);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedSkills(next);
  }

  async function finish() {
    setPending(true);
    setError(null);
    for (const name of selectedSkills) {
      if (addedSkills.has(name)) continue;
      await addSkill(name);
      setAddedSkills((prev) => new Set(prev).add(name));
    }
    const result = await completeOnboarding();
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 text-center">
        <CaveroMark className="mx-auto mb-3 h-11 w-11 text-[#0F2338] dark:text-foreground" />
        <h1 className="text-xl font-bold tracking-tight">
          {userName}님의 CAVERO를 시작합니다
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          스펙을 관리하는 게 아니라, 다음 합격을 설계합니다. 3단계면 충분해요.
        </p>
      </div>

      {/* 단계 표시 */}
      <div className="mb-5 flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-secondary text-muted-foreground",
              )}
            >
              {i < step ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
              {s.label}
            </div>
            {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
          </React.Fragment>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6">
        {step === 0 && (
          <form onSubmit={submitGoal} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ob-goal">어떤 목표를 향해 가고 있나요? *</Label>
              <Input
                id="ob-goal"
                name="name"
                required
                maxLength={120}
                placeholder="예: AI Software Engineer, 네이버 서비스 기획자"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ob-type">목표 유형</Label>
                <Select id="ob-type" name="type" defaultValue="ROLE">
                  {Object.entries(GOAL_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-period">목표 시기</Label>
                <Input id="ob-period" name="targetPeriod" placeholder="예: 2027 상반기" maxLength={60} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-roles">희망 직무 (쉼표 구분)</Label>
              <Input id="ob-roles" name="targetRolesText" placeholder="예: AI 엔지니어, 백엔드 개발자" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-companies">희망 기업 (쉼표 구분)</Label>
              <Input id="ob-companies" name="targetCompaniesText" placeholder="예: 네이버, 토스" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              다음
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={submitProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ob-headline">나를 한 줄로 표현하면?</Label>
              <Input id="ob-headline" name="headline" placeholder="예: Software × AI" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-summary">간단한 소개</Label>
              <Textarea
                id="ob-summary"
                name="summary"
                rows={3}
                placeholder="지금까지의 경험과 관심사를 2~3문장으로"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-github">GitHub 아이디 (선택)</Label>
              <Input id="ob-github" name="githubUsername" placeholder="예: zun-dev" maxLength={60} />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(0)} disabled={pending}>
                이전
              </Button>
              <Button type="submit" className="flex-1" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                다음
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>보유하거나 키우고 싶은 스킬을 선택하세요</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                점수는 선택이 아니라 근거(프로젝트·수상·활동)로 계산됩니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SKILL_CATALOG.map((skill) => {
                const on = selectedSkills.has(skill.name) || addedSkills.has(skill.name);
                return (
                  <button
                    key={skill.name}
                    type="button"
                    onClick={() => toggleSkill(skill.name)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {skill.name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              완료하면 기존에 등록한 활동·수상 기록을 근거(Evidence)로 자동으로 가져와 첫 Career
              Score를 계산합니다.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={pending}>
                이전
              </Button>
              <Button className="flex-1" onClick={finish} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Career Profile 만들기
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
