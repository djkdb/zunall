import { and, desc, eq } from "drizzle-orm";
import { db, users, activities, retrospectives, careerProfiles, careerGoals, careerEvidence } from "@/lib/db";
import { CaveroMark } from "@/components/brand/logo";
import { ACTIVITY_TYPES, ACTIVITY_STATUSES, type ActivityType, type ActivityStatus } from "@/lib/constants";
import { formatDate, safeHttpUrl, safeJsonParse } from "@/lib/utils";
import { EVIDENCE_KINDS, type EvidenceKind } from "@/lib/career-constants";

/**
 * 포트폴리오 본문.
 * 내 화면(/portfolio)과 공유 링크(/p/<토큰>)가 같은 내용을 보여주도록 한 곳에 둔다.
 */
export async function PortfolioDocument({ userId }: { userId: string }) {
  const owner = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!owner) return null;
  const user = { name: owner.name };

  // 서로 독립적인 조회 — 한 번에 보낸다.
  const [acts, retros, profileRows, goalRows, evidenceRows] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.endDate), desc(activities.createdAt)),
    db.select().from(retrospectives).where(eq(retrospectives.userId, userId)),
    db.select().from(careerProfiles).where(eq(careerProfiles.userId, userId)).limit(1),
    db
      .select()
      .from(careerGoals)
      .where(and(eq(careerGoals.userId, userId), eq(careerGoals.isActive, 1)))
      .limit(1),
    db
      .select()
      .from(careerEvidence)
      .where(eq(careerEvidence.userId, userId))
      .orderBy(desc(careerEvidence.createdAt)),
  ]);
  const retroByActivity = new Map(retros.map((r) => [r.activityId, r]));
  const profile = profileRows[0];
  const goal = goalRows[0];

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

  // 커리어에 남긴 근거(프로젝트·수상·자격증 등).
  // 개발자·디자이너에게 포트폴리오의 핵심은 프로젝트인데, 여기엔 활동 회고만 나와서
  // 공유 링크를 만들어도 "아직 기록이 없습니다"만 보였다.
  // 활동에서 가져온 근거는 아래 활동 항목과 겹치므로 뺀다.
  const shownActivityIds = new Set(items.map((a) => a.id));
  const projects = evidenceRows
    .filter((e) => !(e.sourceType === "activity" && e.sourceId && shownActivityIds.has(e.sourceId)))
    .sort((a, b) => kindRank(a.kind) - kindRank(b.kind));

  return (
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

        {projects.length > 0 && (
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              프로젝트와 기록
            </h3>
            <ul className="space-y-4">
              {projects.map((item) => {
                const skills = safeJsonParse<string[]>(item.skills, []);
                // 공유 링크로 남에게 보이는 페이지다 — http/https 만 링크로 그린다
                const link = safeHttpUrl(item.url);
                return (
                  <li key={item.id} className="break-inside-avoid">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <h4 className="text-base font-semibold">{item.title}</h4>
                      <span className="text-xs text-muted-foreground">
                        {EVIDENCE_KINDS[item.kind as EvidenceKind] ?? "기록"}
                      </span>
                    </div>
                    {item.description && <p className="mt-1 text-sm leading-relaxed">{item.description}</p>}
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-1 inline-block break-all text-xs text-primary hover:underline print:text-foreground"
                      >
                        {link}
                      </a>
                    )}
                    {skills.length > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {skills.map((skill) => `#${skill}`).join("  ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {projects.length > 0 && items.length > 0 && (
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">활동</h3>
        )}

        {items.length === 0 && projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 기록이 없습니다. 커리어에서 프로젝트·수상을 근거로 남기거나, 활동 상세 → 기록 탭에서 회고를
            남기면 여기 모입니다.
          </p>
        ) : items.length === 0 ? null : (
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
  );
}

/** 포트폴리오에서 먼저 보여줄 근거 종류 */
const KIND_ORDER = ["award", "project", "work", "portfolio", "github", "certificate", "activity", "content", "education", "etc"];
function kindRank(kind: string): number {
  const index = KIND_ORDER.indexOf(kind);
  return index === -1 ? KIND_ORDER.length : index;
}
