import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db, activities, retrospectives, careerProfiles, careerGoals } from "@/lib/db";
import { CaveroMark } from "@/components/brand/logo";
import { PrintButton } from "@/components/portfolio/print-button";
import { ACTIVITY_TYPES, ACTIVITY_STATUSES, type ActivityType, type ActivityStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { and } from "drizzle-orm";

export const metadata: Metadata = { title: "포트폴리오" };

/**
 * 포트폴리오 한 장.
 * 이미 쌓인 활동 기록·회고를 인쇄용 레이아웃으로 모아 보여준다.
 * 브라우저의 '인쇄 → PDF로 저장' 으로 그대로 파일이 된다.
 */
export default async function PortfolioPage() {
  const user = await requireUser();

  const acts = await db
    .select()
    .from(activities)
    .where(eq(activities.userId, user.id))
    .orderBy(desc(activities.endDate), desc(activities.createdAt));

  const retros = await db
    .select()
    .from(retrospectives)
    .where(eq(retrospectives.userId, user.id));
  const retroByActivity = new Map(retros.map((r) => [r.activityId, r]));

  const profile = (
    await db.select().from(careerProfiles).where(eq(careerProfiles.userId, user.id)).limit(1)
  )[0];
  const goal = (
    await db
      .select()
      .from(careerGoals)
      .where(and(eq(careerGoals.userId, user.id), eq(careerGoals.isActive, 1)))
      .limit(1)
  )[0];

  // 기록할 내용이 있는 활동만 (역할·성과·배운 점·회고 중 하나라도)
  const items = acts.filter(
    (a) =>
      a.role ||
      a.achievement ||
      a.learned ||
      a.skills ||
      retroByActivity.has(a.id) ||
      a.status === "won",
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold tracking-tight">포트폴리오</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            활동 기록과 회고를 한 장으로 모았습니다. 인쇄하면 그대로 PDF가 됩니다.
          </p>
        </div>
        <PrintButton />
      </div>

      <article className="rounded-lg border bg-card p-6 print:border-0 print:p-0 print:shadow-none">
        <header className="mb-6 border-b pb-4">
          <div className="flex items-center gap-2">
            <CaveroMark className="h-8 w-8 text-[#0F2338] dark:text-foreground print:text-[#0F2338]" />
            <div>
              <h2 className="text-lg font-bold">{user.name}</h2>
              <p className="text-sm text-muted-foreground">
                {[profile?.headline, goal ? `목표: ${goal.name}` : null].filter(Boolean).join(" · ") ||
                  "대외활동 포트폴리오"}
              </p>
            </div>
          </div>
          {profile?.summary && <p className="mt-3 text-sm leading-relaxed">{profile.summary}</p>}
        </header>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 기록이 없습니다. 활동 상세 → 기록 탭에서 회고와 성과를 남기면 여기 모입니다.
          </p>
        ) : (
          <ol className="space-y-6">
            {items.map((activity) => {
              const retro = retroByActivity.get(activity.id);
              const skills: string[] = activity.skills
                ? activity.skills.split(",").map((s) => s.trim()).filter(Boolean)
                : retro?.skills
                  ? (JSON.parse(retro.skills) as string[])
                  : [];
              const period = [activity.startDate, activity.endDate].filter(Boolean).join(" ~ ");

              return (
                <li key={activity.id} className="break-inside-avoid">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h3 className="text-base font-semibold">{activity.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      {ACTIVITY_TYPES[activity.type as ActivityType] ?? activity.type}
                      {activity.organizer ? ` · ${activity.organizer}` : ""}
                      {period ? ` · ${formatDate(period.split(" ~ ")[0])}${activity.endDate ? ` ~ ${formatDate(activity.endDate)}` : ""}` : ""}
                    </span>
                    {activity.status === "won" && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 print:border print:border-amber-300">
                        {ACTIVITY_STATUSES[activity.status as ActivityStatus]}
                      </span>
                    )}
                  </div>

                  {activity.role && (
                    <p className="mt-1 text-sm">
                      <span className="font-medium">역할</span> · {activity.role}
                    </p>
                  )}

                  {retro && (
                    <div className="mt-2 space-y-1 text-sm leading-relaxed">
                      {retro.situation && <p><span className="font-medium">상황</span> · {retro.situation}</p>}
                      {retro.task && <p><span className="font-medium">과제</span> · {retro.task}</p>}
                      {retro.action && <p><span className="font-medium">행동</span> · {retro.action}</p>}
                      {retro.result && <p><span className="font-medium">결과</span> · {retro.result}</p>}
                    </div>
                  )}

                  {activity.achievement && (
                    <p className="mt-1 text-sm">
                      <span className="font-medium">성과</span> · {activity.achievement}
                    </p>
                  )}
                  {(retro?.learned || activity.learned) && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      배운 점 · {retro?.learned || activity.learned}
                    </p>
                  )}

                  {skills.length > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {skills.map((skill) => `#${skill}`).join("  ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <footer className="mt-8 border-t pt-3 text-xs text-muted-foreground">
          Cavero 로 정리한 활동 기록 · {new Date().toISOString().slice(0, 10)}
        </footer>
      </article>
    </div>
  );
}
