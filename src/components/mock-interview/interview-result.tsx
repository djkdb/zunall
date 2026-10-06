import Link from "next/link";
import { AlertTriangle, CheckCircle2, Repeat2, Target, TrendingUp } from "lucide-react";
import type { Interview } from "@/services/mock-interview/types";
import { CATEGORY_KEYS, type CategoryKey } from "@/services/mock-interview/shared/schemas";
import { CATEGORY_DESC_KO, CATEGORY_KO, DIFFICULTY_KO, INTERVIEW_TYPE_KO, QUESTION_TYPE_KO, grade } from "@/services/mock-interview/labels-ko";
import { strongestAndWeakest } from "@/services/mock-interview/utils/scoring";
import { conductLabel } from "@/services/mock-interview/utils/conduct";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReanswerBox } from "./reanswer-box";
import { SaveToPrepButton } from "./save-to-prep-button";
import { DeleteInterviewButton } from "./delete-interview-button";

const STAR_LABEL = { situation: "상황", task: "과제", action: "행동", result: "결과" } as const;
const STAR_TONE = {
  present: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  missing: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
} as const;

function tone(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 65) return "text-sky-600 dark:text-sky-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function minutes(sec: number) {
  if (sec < 60) return `${sec}초`;
  return `${Math.round(sec / 60)}분`;
}

export function InterviewResult({
  interview: i,
  activity,
  companyName,
}: {
  interview: Interview;
  activity: { id: string; name: string } | null;
  companyName: string | null;
}) {
  const scores = i.categoryScores;
  const overall = i.overallScore ?? 0;
  const { strongest, weakest } = scores ? strongestAndWeakest(scores) : { strongest: null, weakest: null };
  const usedAi = i.providers.includes("ai");
  const r = i.report;
  let mainNo = 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-baseline gap-2">
            <span className={cn("text-4xl font-bold tabular-nums", tone(overall))} data-testid="mi-overall">
              {overall}
            </span>
            <span className="text-sm text-muted-foreground">/ 100 · {grade(overall)}등급</span>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {i.terminated && (
              <p className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
                <AlertTriangle className="h-3 w-3" /> {conductLabel(i.terminated)}
              </p>
            )}
            {r?.headline && <p className="font-medium leading-relaxed">{r.headline}</p>}
            <p className="text-xs text-muted-foreground">
              {[
                companyName ? `${companyName} 면접 연습` : null,
                INTERVIEW_TYPE_KO[i.config.interviewType],
                `${DIFFICULTY_KO[i.config.difficulty]} 난이도`,
                `문답 ${i.questions.length}개`,
                i.duration ? `${minutes(i.duration)}` : null,
                i.endedEarly && !i.terminated ? "중간에 끝냄" : null,
                usedAi ? "AI 면접관" : "간이 면접관 (AI 대신 규칙으로 채점)",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {activity && (
              <p className="text-xs text-muted-foreground">
                연결된 활동:{" "}
                <Link href={`/activities/${activity.id}?tab=interview`} className="text-primary hover:underline">
                  {activity.name}
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {r?.topFeedback && (
        <Card className="border-primary/40">
          <CardContent className="flex gap-3 p-5">
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold text-primary">가장 먼저 고칠 것</p>
              <p className="mt-1 text-sm leading-relaxed">{r.topFeedback}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {scores && (
        <Card>
          <CardHeader>
            <CardTitle>항목별 점수</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {CATEGORY_KEYS.map((k: CategoryKey) => (
              <div key={k} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-sm">
                <span className="truncate" title={CATEGORY_DESC_KO[k]}>
                  {CATEGORY_KO[k]}
                  {k === strongest && <span className="ml-1 text-[10px] text-emerald-600">최고</span>}
                  {k === weakest && <span className="ml-1 text-[10px] text-rose-600">약점</span>}
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${scores[k]}%` }} />
                </div>
                <span className="text-right tabular-nums text-muted-foreground">{scores[k]}</span>
              </div>
            ))}
            {weakest && <p className="pt-1 text-xs text-muted-foreground">약점 &lsquo;{CATEGORY_KO[weakest]}&rsquo;: {CATEGORY_DESC_KO[weakest]}</p>}
          </CardContent>
        </Card>
      )}

      {r && (r.strengths.length > 0 || r.improvements.length > 0 || r.nextSteps.length > 0) && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "잘한 점", items: r.strengths, icon: CheckCircle2, cls: "text-emerald-600" },
            { title: "보완할 점", items: r.improvements, icon: TrendingUp, cls: "text-amber-600" },
            { title: "다음 연습", items: r.nextSteps, icon: Repeat2, cls: "text-primary" },
          ].map((b) => (
            <Card key={b.title}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5">
                  <b.icon className={cn("h-4 w-4", b.cls)} /> {b.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed">
                  {b.items.map((x, n) => (
                    <li key={n}>{x}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {i.documentChecks && i.documentChecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>서류와 답변 비교</CardTitle>
            <p className="text-xs text-muted-foreground">면접관은 서류에 쓴 숫자·역할을 머릿속으로 맞춰 봅니다. 실제 면접 전에 맞춰 두세요.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {i.documentChecks.map((c, n) => (
                <li key={n} className="flex gap-2">
                  <span
                    className={cn(
                      "h-fit shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
                      c.status === "mismatch" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" : c.status === "unexplained" ? STAR_TONE.partial : STAR_TONE.present,
                    )}
                  >
                    {c.status === "mismatch" ? "다름" : c.status === "unexplained" ? "설명 부족" : "일치"}
                  </span>
                  <span>
                    {c.source === "resume" ? "이력" : "자기소개서"} &lsquo;{c.claim}&rsquo; — {c.detail}{" "}
                    <span className="text-xs text-muted-foreground">({c.questionNo}번 문답)</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">문답별 피드백</h2>
        {i.questions.map((q) => {
          if (!q.isFollowUp) mainNo++;
          const f = q.feedback;
          const tries = (i.reanswers ?? []).filter((x) => x.questionId === q.id);
          return (
            <Card key={q.id} className={cn(q.isFollowUp && "ml-4 border-dashed")}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {q.isFollowUp ? `↳ ${mainNo}번 꼬리질문` : `Q${mainNo}`} · {QUESTION_TYPE_KO[q.type]}
                    </p>
                    <p className="mt-0.5 font-medium leading-relaxed">{q.text}</p>
                  </div>
                  {q.score !== null && (
                    <span className={cn("shrink-0 text-lg font-bold tabular-nums", tone(q.score))}>
                      {q.score}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">{grade(q.score)}</span>
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap rounded-md bg-secondary/60 px-3 py-2 text-sm leading-relaxed">{q.answer}</p>
                {f && (
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <p>
                      <span className="mr-1 text-xs font-semibold text-emerald-600">좋았던 점</span>
                      {f.strength}
                    </p>
                    <p>
                      <span className="mr-1 text-xs font-semibold text-amber-600">고칠 점</span>
                      {f.improve}
                    </p>
                  </div>
                )}
                {f?.star.applicable && (
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {(Object.keys(STAR_LABEL) as Array<keyof typeof STAR_LABEL>).map((k) => (
                      <span key={k} className={cn("rounded px-1.5 py-0.5", STAR_TONE[f.star[k].status])} title={f.star[k].note}>
                        {STAR_LABEL[k]} {f.star[k].status === "present" ? "✓" : f.star[k].status === "partial" ? "△" : "✗"}
                      </span>
                    ))}
                  </div>
                )}
                {f?.betterAnswer.example && (
                  <details className="rounded-md border px-3 py-2 text-sm">
                    <summary className="cursor-pointer text-xs font-medium text-primary">이렇게 바꿔 말해 보기</summary>
                    <p className="mt-2 text-muted-foreground">{f.betterAnswer.suggestion}</p>
                    <p className="mt-1 leading-relaxed">{f.betterAnswer.example}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">[ ] 안은 내 실제 경험으로 채우세요. 없는 사실을 만들어 말하면 꼬리질문에서 드러납니다.</p>
                  </details>
                )}
                {f?.roleSignal && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{f.roleSignal.label}</span> — {f.roleSignal.note}
                  </p>
                )}
                {f && f.notFound.length > 0 && <p className="text-xs text-muted-foreground">빠진 것: {f.notFound.join(", ")}</p>}
                {tries.map((t, n) => (
                  <div key={n} className="rounded-md border border-primary/30 px-3 py-2 text-sm">
                    <p className="text-xs font-medium text-primary">
                      다시 답한 결과 {t.score}점 ({t.score - (q.score ?? 0) >= 0 ? "+" : ""}
                      {t.score - (q.score ?? 0)})
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{t.answer}</p>
                    <p className="mt-1 text-xs">{t.feedback.improve}</p>
                  </div>
                ))}
                <div className="flex flex-wrap items-start gap-2">
                  <ReanswerBox interviewId={i.id} questionId={q.id} key={`${q.id}-${tries.length}`} />
                  {activity && <SaveToPrepButton interviewId={i.id} questionId={q.id} />}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/interview/new?from=${i.id}`} className={buttonVariants({ variant: "default" })}>
          <Repeat2 /> 같은 설정으로 다시 보기
        </Link>
        <Link href="/interview" className={buttonVariants({ variant: "outline" })}>
          면접 기록
        </Link>
        <DeleteInterviewButton interviewId={i.id} />
      </div>
      {r?.closingRemark && <p className="text-sm text-muted-foreground">&ldquo;{r.closingRemark}&rdquo;</p>}
      <p className="text-xs text-muted-foreground">
        연습용 피드백입니다. 실제 채용 결과나 능력을 판정하지 않습니다. 기업 면접 질문은 공개 후기·공식 자료를 바탕으로 다시 쓴 연습 질문이며, 해당 기업과 관계가 없습니다.
      </p>
    </div>
  );
}
