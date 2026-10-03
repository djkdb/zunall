import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Crosshair, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db, activities, opportunityAnalyses, noticeSources, noticeItems } from "@/lib/db";
import { getCareerContext } from "@/lib/career-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalyzeFitButton } from "@/components/career/analyze-fit-button";
import { NoticeFeed } from "@/components/notices/notice-feed";
import { TabNav } from "@/components/ui/tab-nav";
import { nearestDeadlineOf } from "@/lib/queries";
import {
  ACTIVITY_TYPES,
  ACTIVITY_STATUSES,
  STATUS_BADGE_CLASSES,
  FINISHED_STATUSES,
  type ActivityType,
  type ActivityStatus,
} from "@/lib/constants";
import { cn, ddayColorClass, ddayDotClass, ddayLabel } from "@/lib/utils";

/** 대학생 공고가 많이 모이는 곳 (바깥 사이트 — 새 창으로 연다) */
const NOTICE_SITES = [
  { name: "링커리어", url: "https://linkareer.com", what: "대외활동·공모전·인턴" },
  { name: "위비티", url: "https://www.wevity.com", what: "공모전" },
  { name: "씽굿", url: "https://www.thinkcontest.com", what: "공모전" },
  { name: "캠퍼스픽", url: "https://www.campuspick.com", what: "대외활동·공모전" },
  // 전공에 따라 공고가 모이는 곳이 다르다
  { name: "Q-Net", url: "https://www.q-net.or.kr", what: "국가자격증 시험 일정" },
  { name: "한국문화예술위원회", url: "https://www.arko.or.kr", what: "예술 지원사업·공모" },
  { name: "1365 자원봉사", url: "https://www.1365.go.kr", what: "봉사활동" },
];

export const metadata: Metadata = { title: "Opportunities" };

const REC_BADGES: Record<string, { label: string; className: string }> = {
  apply: { label: "지원 추천", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  hold: { label: "보강 후 지원", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  skip: { label: "지원 비추천", className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
};

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "feed" ? "feed" : "fit";

  const [ctx, actRows, analyses, sources, newItems] = await Promise.all([
    getCareerContext(user.id),
    db
      .select()
      .from(activities)
      .where(eq(activities.userId, user.id))
      .orderBy(desc(activities.updatedAt)),
    db.select().from(opportunityAnalyses).where(eq(opportunityAnalyses.userId, user.id)),
    db
      .select()
      .from(noticeSources)
      .where(eq(noticeSources.userId, user.id))
      .orderBy(desc(noticeSources.createdAt)),
    db
      .select()
      .from(noticeItems)
      .where(and(eq(noticeItems.userId, user.id), eq(noticeItems.status, "new")))
      .orderBy(desc(noticeItems.foundAt))
      .limit(50),
  ]);
  const acts = actRows.filter((a) => !(FINISHED_STATUSES as string[]).includes(a.status));
  const analysisByActivity = new Map(analyses.map((a) => [a.activityId, a]));

  // 분석된 것은 적합도 높은 순, 미분석은 뒤로
  const sorted = [...acts].sort((a, b) => {
    const fa = analysisByActivity.get(a.id)?.fitScore ?? -1;
    const fb = analysisByActivity.get(b.id)?.fitScore ?? -1;
    return fb - fa;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">기회 찾기</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            &ldquo;좋은 기회인가?&rdquo;가 아니라 &ldquo;지금의 나에게 좋은 기회인가?&rdquo;를
            판단합니다.
            {ctx.goal &&
              (ctx.exploring
                ? ` 진로를 정하는 중이라 ‘${ctx.template.label}’ 기준을 임시로 적용해 판단합니다.`
                : ` 기준 목표: ${ctx.goal.name}`)}
          </p>
        </div>
        <Link href="/activities/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> 기회 등록
          </Button>
        </Link>
      </div>

      <TabNav
        tabs={[
          { key: "fit", label: "내 활동 적합도" },
          { key: "feed", label: "수집한 공고", count: newItems.length },
        ]}
        active={tab}
        hrefPrefix="/opportunities?tab="
      />

      {tab === "feed" ? (
        <NoticeFeed sources={sources} items={newItems} />
      ) : (
        <>
      {!ctx.onboarded && (
        <div className="rounded-lg border border-primary/40 bg-accent/40 p-4 text-sm">
          적합도 분석을 사용하려면 먼저{" "}
          <Link href="/career" className="font-medium text-primary hover:underline">
            내 커리어
          </Link>
          을 만들어주세요.
        </div>
      )}

      {sorted.length === 0 ? (
        <>
          <EmptyState
            icon={Crosshair}
            title="진행 중인 기회가 없습니다"
            description="공모전, 대외활동, 채용 공고를 등록하면 내 커리어 목표 기준으로 지원 가치를 분석해드립니다."
            action={
              <Link href="/activities/new">
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" /> 기회 등록
                </Button>
              </Link>
            }
          />
          {/* 처음 온 사람은 "공고를 어디서 찾지?"에서 막힌다 */}
          <div className="rounded-lg border p-4 text-sm">
            <p className="font-semibold">공고는 이런 곳에 모여 있습니다</p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {NOTICE_SITES.map((site) => (
                <li key={site.url}>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {site.name}
                  </a>{" "}
                  <span className="text-xs text-muted-foreground">{site.what}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              마음에 드는 공고의 주소를 복사해 &lsquo;기회 등록&rsquo;에 붙여넣으면 마감일과 제출 서류를 읽어 옵니다.
              사이트에 따라 일부는 직접 입력해야 할 수 있습니다.
            </p>
          </div>
        </>
      ) : (
        <ul className="space-y-3">
          {sorted.map((activity) => {
            const analysis = analysisByActivity.get(activity.id);
            const deadline = nearestDeadlineOf(activity);
            const rec = analysis?.recommendation ? REC_BADGES[analysis.recommendation] : null;
            return (
              <li
                key={activity.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: activity.color }}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/activities/${activity.id}?tab=fit`}
                    className="block truncate font-semibold hover:text-primary"
                  >
                    {activity.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary">
                      {ACTIVITY_TYPES[activity.type as ActivityType] ?? activity.type}
                    </Badge>
                    <Badge className={STATUS_BADGE_CLASSES[activity.status as ActivityStatus] ?? ""}>
                      {ACTIVITY_STATUSES[activity.status as ActivityStatus] ?? activity.status}
                    </Badge>
                    {activity.organizer && <span>{activity.organizer}</span>}
                    {deadline && (
                      <span className={cn("flex items-center gap-1 font-semibold", ddayColorClass(deadline.days))}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", ddayDotClass(deadline.days))} />
                        {deadline.label} {ddayLabel(deadline.days)}
                      </span>
                    )}
                  </div>
                  {analysis?.recommendation === "skip" && analysis.recommendationReason && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {analysis.recommendationReason}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {analysis ? (
                    <>
                      <div className="text-right">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          적합도
                        </p>
                        <p className="text-xl font-bold leading-none">
                          {Math.round(analysis.fitScore ?? 0)}
                        </p>
                      </div>
                      {rec && <Badge className={rec.className}>{rec.label}</Badge>}
                    </>
                  ) : ctx.onboarded ? (
                    <AnalyzeFitButton activityId={activity.id} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
        </>
      )}
    </div>
  );
}
