"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Search, X } from "lucide-react";
import { startMockInterview, type MockInterviewSetup } from "@/actions/mock-interview";
import type { CompanyOption, RoleOption } from "@/services/mock-interview/catalog";
import { DIFFICULTY_KO, EXPERIENCE_KO, INTERVIEW_TYPE_HINT_KO, INTERVIEW_TYPE_KO, PERSONA_KO } from "@/services/mock-interview/labels-ko";
import type { Difficulty, ExperienceLevel, InterviewType, Persona } from "@/services/mock-interview/shared/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AIWaitHint } from "@/components/ai/ai-wait-hint";
import { cn } from "@/lib/utils";

export interface SetupActivity {
  id: string;
  name: string;
  hasEssays: boolean;
  hasNotice: boolean;
}

export interface SetupDefaults {
  roleId: string | null;
  position: string;
  companyId: string | null;
  companyTrack: string | null;
  activityId: string | null;
  interviewType: InterviewType;
  difficulty: Difficulty;
  questionLimit: number;
  experience: ExperienceLevel;
  persona: Persona;
  useEssays: boolean;
  useProfile: boolean;
  voiceEnabled: boolean;
}

const TYPES: InterviewType[] = ["mixed", "hr", "technical", "behavioral"];
const LEVELS: Difficulty[] = ["easy", "normal", "hard"];
const COUNTS = [3, 5, 7, 10];
const PERSONAS_SHOWN: Persona[] = ["professional", "friendly", "strict", "technical"];

function Chips<T extends string | number>({
  name,
  value,
  options,
  label,
  hint,
  onChange,
}: {
  name: string;
  value: T;
  options: T[];
  label: (v: T) => string;
  hint?: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
            value === o ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-accent",
          )}
        >
          {label(o)}
          {hint && <span className="block text-[11px] font-normal text-muted-foreground">{hint(o)}</span>}
        </button>
      ))}
    </div>
  );
}

export function SetupForm({
  roles,
  companies,
  activities,
  defaults,
  aiReal,
  hasEvidence,
}: {
  roles: RoleOption[];
  companies: CompanyOption[];
  activities: SetupActivity[];
  defaults: SetupDefaults;
  aiReal: boolean;
  hasEvidence: boolean;
}) {
  const router = useRouter();
  const [roleId, setRoleId] = React.useState<string | null>(defaults.roleId);
  const [position, setPosition] = React.useState(defaults.position);
  const [query, setQuery] = React.useState("");
  const [companyId, setCompanyId] = React.useState(defaults.companyId ?? "");
  const [track, setTrack] = React.useState(defaults.companyTrack ?? "");
  const [activityId, setActivityId] = React.useState(defaults.activityId ?? "");
  const [useEssays, setUseEssays] = React.useState(defaults.useEssays);
  const [useProfile, setUseProfile] = React.useState(defaults.useProfile);
  const [interviewType, setInterviewType] = React.useState<InterviewType>(defaults.interviewType);
  const [difficulty, setDifficulty] = React.useState<Difficulty>(defaults.difficulty);
  const [questionLimit, setQuestionLimit] = React.useState(defaults.questionLimit);
  const [experience, setExperience] = React.useState<ExperienceLevel>(defaults.experience);
  const [persona, setPersona] = React.useState<Persona>(defaults.persona);
  const [jd, setJd] = React.useState("");
  const [voiceEnabled, setVoiceEnabled] = React.useState(defaults.voiceEnabled);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const company = companies.find((c) => c.id === companyId) ?? null;
  const activity = activities.find((a) => a.id === activityId) ?? null;
  const selectedRole = roleId ? roles.find((r) => r.id === roleId) : null;

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return [];
    const words = q.split(" ");
    return roles
      .map((r) => ({ r, starts: r.ko.toLowerCase().startsWith(q) }))
      .filter(({ r }) => words.every((w) => r.keys.includes(w)))
      .sort((a, b) => Number(b.starts) - Number(a.starts) || a.r.ko.length - b.r.ko.length)
      .slice(0, 8)
      .map(({ r }) => r);
  }, [query, roles]);

  const byCategory = React.useMemo(() => {
    const m = new Map<string, CompanyOption[]>();
    for (const c of companies) m.set(c.category, [...(m.get(c.category) ?? []), c]);
    return [...m.entries()];
  }, [companies]);

  function pickRole(r: RoleOption) {
    setRoleId(r.id);
    setPosition(r.ko);
    setQuery("");
  }

  async function start() {
    setPending(true);
    setError(null);
    const setup: MockInterviewSetup = {
      roleId,
      position: position.trim(),
      companyId: companyId || null,
      companyTrack: track || null,
      interviewType,
      difficulty,
      questionLimit,
      experience,
      persona,
      activityId: activityId || null,
      useEssays: Boolean(activity?.hasEssays && useEssays),
      useProfile: hasEvidence && useProfile,
      jobDescription: jd,
      voiceEnabled,
    };
    const result = await startMockInterview(setup);
    if (!result.ok) {
      setPending(false);
      return setError(result.error);
    }
    router.push(`/interview/${result.id}`);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <Label htmlFor="mi-role">어떤 직무로 면접을 볼까요?</Label>
        {selectedRole || (!roleId && position) ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-sm font-medium" data-testid="mi-selected-role">
              {position}
              {selectedRole && <span className="text-xs font-normal text-muted-foreground">· {selectedRole.family}</span>}
              {!selectedRole && <span className="text-xs font-normal text-muted-foreground">· 비슷한 직무 질문으로 진행</span>}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setRoleId(null); setPosition(""); }}>
              <X /> 바꾸기
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="mi-role"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="예: 마케터, 간호사, 회계, 백엔드, 학예사, 트레이너"
                className="pl-8"
                autoComplete="off"
              />
            </div>
            {matches.length > 0 && (
              <ul className="divide-y rounded-md border" role="listbox" aria-label="직무 검색 결과">
                {matches.map((r) => (
                  <li key={r.id}>
                    <button type="button" role="option" aria-selected={false} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => pickRole(r)}>
                      <span className="font-medium">{r.ko}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.domain} › {r.family}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  setRoleId(null);
                  setPosition(query.trim().slice(0, 80));
                  setQuery("");
                }}
              >
                목록에 없어요 — &lsquo;{query.trim()}&rsquo;(으)로 면접 보기
              </button>
            )}
            <p className="text-xs text-muted-foreground">직무 {roles.length}개 · 공학·상경·인문·예체능·보건·공공 모두 있습니다.</p>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mi-company">기업 면접 연습 (선택)</Label>
          <Select id="mi-company" value={companyId} onChange={(e) => { setCompanyId(e.target.value); setTrack(""); }}>
            <option value="">기업 없이 직무 면접</option>
            {byCategory.map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          {company && (
            <p className="text-xs text-muted-foreground">
              {company.industry} · 공개 후기·공식 자료 기반 질문 {company.questionCount}개에서 묻습니다.
            </p>
          )}
        </div>
        {company && company.tracks.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="mi-track">지원 직군</Label>
            <Select id="mi-track" value={track} onChange={(e) => setTrack(e.target.value)}>
              <option value="">직무에 맞춰 자동</option>
              {company.tracks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <Label htmlFor="mi-activity">지원한 공고와 연결 (선택)</Label>
        <Select id="mi-activity" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
          <option value="">연결하지 않음</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        {activity && (
          <div className="space-y-1.5 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <p>{activity.hasNotice ? "올려 둔 공고문의 요구 역량을 실제 경험으로 확인하는 질문이 나옵니다." : "공고문을 올려 두면 공고 요구 역량을 확인하는 질문도 나옵니다."}</p>
            {activity.hasEssays ? (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={useEssays} onChange={(e) => setUseEssays(e.target.checked)} />
                이 활동에 쓴 자기소개서로 질문받기 (서류 기반 면접)
              </label>
            ) : (
              <p>이 활동에 쓴 자기소개서가 아직 없습니다.</p>
            )}
            <p>면접에서 받은 질문과 내 답을 이 활동의 &lsquo;면접 준비&rsquo;에 담을 수 있습니다.</p>
          </div>
        )}
        {hasEvidence && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useProfile} onChange={(e) => setUseProfile(e.target.checked)} />
            내 커리어 근거(경험 목록)를 이력서처럼 보고 질문받기
          </label>
        )}
        {(useEssays && activity?.hasEssays) || useProfile ? (
          <p className="text-xs text-muted-foreground">서류는 이메일·전화번호·링크를 가리고 보내며, 면접이 끝나면 원문은 기록에 남기지 않습니다.</p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">면접 종류</p>
          <Chips name="면접 종류" value={interviewType} options={TYPES} label={(t) => INTERVIEW_TYPE_KO[t]} hint={(t) => INTERVIEW_TYPE_HINT_KO[t]} onChange={setInterviewType} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">난이도</p>
            <Chips name="난이도" value={difficulty} options={LEVELS} label={(d) => DIFFICULTY_KO[d]} onChange={setDifficulty} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">본 질문 수 (꼬리질문은 따로)</p>
            <Chips name="질문 수" value={questionLimit} options={COUNTS} label={(n) => `${n}개`} onChange={setQuestionLimit} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">면접관 성향</p>
            <Chips name="면접관 성향" value={persona} options={PERSONAS_SHOWN} label={(p) => PERSONA_KO[p]} onChange={setPersona} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mi-exp">경력</Label>
            <Select id="mi-exp" value={experience} onChange={(e) => setExperience(e.target.value as ExperienceLevel)}>
              {(Object.keys(EXPERIENCE_KO) as ExperienceLevel[]).map((k) => (
                <option key={k} value={k}>
                  {EXPERIENCE_KO[k]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      <details className="rounded-md border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">채용 공고 붙여넣기 (선택)</summary>
        <Textarea className="mt-2" rows={5} value={jd} onChange={(e) => setJd(e.target.value.slice(0, 4000))} placeholder="자격 요건·우대 사항을 붙여 넣으면 그 요구 역량을 실제 경험으로 확인하는 질문이 나옵니다." />
      </details>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} />
        면접관 목소리로 질문 읽어 주기 (브라우저 음성)
      </label>

      <div className="space-y-1">
        <Button type="button" size="lg" onClick={start} disabled={pending || !position.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <Play />} 면접 시작
        </Button>
        <p className="text-xs text-muted-foreground">
          {aiReal ? "AI 면접관이 답을 듣고 꼬리질문을 합니다. 오늘 AI 사용 1회로 셉니다." : "지금은 간이 면접관(규칙 기반)이 진행합니다. AI 키를 연결하면 AI 면접관이 답을 읽고 파고듭니다."}
        </p>
        {aiReal && <AIWaitHint active={pending} />}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
