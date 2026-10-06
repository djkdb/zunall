import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Building2, CalendarClock, Mic, Play } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMockInterviewHistory, getUpcomingInterviews } from "@/lib/mock-interview-queries";
import { CATEGORY_DESC_KO, CATEGORY_KO, grade } from "@/services/mock-interview/labels-ko";
import { CATEGORY_KEYS } from "@/services/mock-interview/shared/schemas";
import { COMPANIES } from "@/services/mock-interview/shared/companies";
import { ROLE_STATS } from "@/services/mock-interview/shared/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, daysUntil, ddayLabel, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "모의 면접" };

function Trend({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const w = 220;
  const h = 48;
  const step = w / (scores.length - 1);
  const pts = scores.map((s, i) => `${(i * step).toFixed(1)},${(h - (s / 100) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-56" role="img" aria-label={`최근 점수 ${scores.join(", ")}`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
      {scores.map((s, i) => (
        <circle key={i} cx={i * step} cy={h - (s / 100) * h} r="2.5" className="fill-primary" />
      ))}
    </svg>
  );
}

export default async function InterviewHomePage() {
  const user = await requireUser();
  const [{ rows, averages, averagedOver }, upcoming] = await Promise.all([getMockInterviewHistory(user.id), getUpcomingInterviews(user.id)]);
  const done = rows.filter((r) => r.status === "completed" && r.overallScore !== null);
  const trend = done.slice(0, 10).reverse().map((r) => r.overallScore as number);
  const weakest = averages ? [...CATEGORY_KEYS].sort((a, b) => averages[a] - averages[b])[0] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">모의 면접</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            직무 {ROLE_STATS.roles}개·질문 {ROLE_STATS.questions.toLocaleString()}개, 기업 {COMPANIES.length}곳의 공개 후기 기반 질문으로 연습합니다. 답을 들으면 꼬리질문으로 파고듭니다.
          </p>
        </div>
        <Link href="/interview/new" className={buttonVariants()}>
          <Play /> 새 면접 시작
        </Link>
      </div>

      {upcoming.length > 0 && (
        <Card className="border-primary/40">
          <CardContent className="space-y-2 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" /> 다가오는 면접
            </p>
            <ul className="space-y-1.5 text-sm">
              {upcoming.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="mr-1.5 font-semibold text-primary">{ddayLabel(daysUntil(e.date))}</span>
                    {e.activityName ?? e.title}
                  </span>
                  <Link href={e.activityId ? `/interview/new?activity=${e.activityId}` : "/interview/new"} className={buttonVariants({ size: "sm", variant: "outline" })}>
                    이 면접 연습하기
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Mic}
          title="아직 본 모의 면접이 없습니다"
          description="목표 직무로 5문항만 먼저 해 보세요. 10분이면 끝나고, 어디서 말이 막히는지 바로 보입니다."
          action={
            <Link href="/interview/new" className={buttonVariants()}>
              <Play /> 첫 모의 면접 보기
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardHeader>
              <CardTitle>면접 기록</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link href={`/interview/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent/50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {r.companyName ? `${r.companyName} · ` : ""}
                          {r.position}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(new Date(r.createdAt).toISOString().slice(0, 10))}</p>
                      </div>
                      {r.status === "completed" ? (
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {r.overallScore ?? "-"}
                          {r.overallScore !== null && <span className="ml-1 text-xs font-normal text-muted-foreground">{grade(r.overallScore)}</span>}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">이어서 하기</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {trend.length >= 2 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>점수 추이</CardTitle>
                </CardHeader>
                <CardContent>
                  <Trend scores={trend} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    최근 {trend.length}회 · 처음 {trend[0]}점 → 최근 {trend[trend.length - 1]}점
                  </p>
                </CardContent>
              </Card>
            )}
            {averages && weakest && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>자주 약한 항목</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <p>
                    최근 {averagedOver}회 평균에서 <b>{CATEGORY_KO[weakest]}</b>({averages[weakest]}점)이 가장 낮습니다.
                  </p>
                  <p className="text-xs text-muted-foreground">{CATEGORY_DESC_KO[weakest]} — 다음 면접에서 이것 하나만 의식해 보세요.</p>
                  <ul className="pt-1 text-xs text-muted-foreground">
                    {CATEGORY_KEYS.map((k) => (
                      <li key={k} className={cn("flex justify-between", k === weakest && "font-medium text-foreground")}>
                        <span>{CATEGORY_KO[k]}</span>
                        <span className="tabular-nums">{averages[k]}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/interview/roles" className="flex items-center gap-2 rounded-lg border p-4 text-sm hover:bg-accent/50">
          <BookOpen className="h-4 w-4 text-primary" />
          <span>
            <span className="font-medium">직무별 면접 질문</span>
            <span className="block text-xs text-muted-foreground">직무 {ROLE_STATS.roles}개 · 보는 역량과 꼬리질문 흐름</span>
          </span>
        </Link>
        <Link href="/interview/companies" className="flex items-center gap-2 rounded-lg border p-4 text-sm hover:bg-accent/50">
          <Building2 className="h-4 w-4 text-primary" />
          <span>
            <span className="font-medium">기업별 면접 질문</span>
            <span className="block text-xs text-muted-foreground">인재상·전형·자주 나온 질문 {COMPANIES.length}곳</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
