import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Target, ArrowRight, BookMarked } from "lucide-react";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db, retrospectives, activities } from "@/lib/db";
import { getCareerContext, getScoreTrend } from "@/lib/career-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OnboardingWizard } from "@/components/career/onboarding-wizard";
import { ProfileImport } from "@/components/career/profile-import";
import { ProfileCompleteness } from "@/components/career/profile-completeness";
import { ReadinessCard } from "@/components/career/readiness-card";
import { SkillList } from "@/components/career/skill-list";
import { MissionCard } from "@/components/career/mission-card";
import { GoalFormDialog } from "@/components/career/goal-form-dialog";
import { ProfileFormDialog } from "@/components/career/profile-form-dialog";
import {
  AddEvidenceDialog,
  ImportEvidenceButton,
  DeleteEvidenceButton,
} from "@/components/career/evidence-manager";
import { EVIDENCE_KINDS, GOAL_TYPES, type EvidenceKind, type GoalType } from "@/lib/career-constants";
import { STUDY_FIELDS } from "@/lib/career-constants";
import { safeJsonParse, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Career Profile" };

export default async function CareerPage() {
  const user = await requireUser();
  const ctx = await getCareerContext(user.id);

  if (!ctx.onboarded) {
    return <OnboardingWizard userName={user.name} />;
  }

  const [trend, activityRows, retrospectiveRows] = await Promise.all([
    getScoreTrend(user.id),
    db.select({ id: activities.id }).from(activities).where(eq(activities.userId, user.id)),
    db.select({ id: retrospectives.id }).from(retrospectives).where(eq(retrospectives.userId, user.id)),
  ]);
  const activityCount = activityRows.length;
  const retrospectiveCount = retrospectiveRows.length;
  const goalRoles = safeJsonParse<string[]>(ctx.goal?.targetRoles, []);
  const goalCompanies = safeJsonParse<string[]>(ctx.goal?.targetCompanies, []);
  const desiredRoles = safeJsonParse<string[]>(ctx.profile?.desiredRoles, []);
  const desiredCompanies = safeJsonParse<string[]>(ctx.profile?.desiredCompanies, []);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            내 커리어
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {ctx.profile?.headline || user.name}
          </h1>
          {ctx.profile?.summary && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{ctx.profile.summary}</p>
          )}
          {/* 점수와 추천이 무엇을 기준으로 계산됐는지 밝힌다. */}
          {(() => {
            const basis = [
              ctx.studyField ? STUDY_FIELDS[ctx.studyField] : null,
              ctx.profile?.major,
              ctx.template.key === "general" ? null : ctx.template.label,
            ].filter(Boolean);
            return (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {basis.length > 0 ? (
                  <>
                    {basis.join(" · ")} 기준 ·{" "}
                    <Link href="/settings" className="text-primary hover:underline">
                      변경
                    </Link>
                  </>
                ) : (
                  <Link href="/settings" className="text-primary hover:underline">
                    전공·희망 직무를 고르면 점수와 추천이 더 정확해집니다
                  </Link>
                )}
              </p>
            );
          })()}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ProfileFormDialog
            profile={ctx.profile}
            desiredRoles={desiredRoles}
            desiredCompanies={desiredCompanies}
          />
          <GoalFormDialog goal={ctx.goal} goalRoles={goalRoles} goalCompanies={goalCompanies} />
        </div>
      </div>

      {/* 목표 카드 */}
      <Card className="border-primary/30">
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">🎯 {ctx.goal?.name ?? "목표 없음"}</span>
          </div>
          {ctx.goal && (
            <>
              <Badge variant="secondary">{GOAL_TYPES[ctx.goal.type as GoalType] ?? ctx.goal.type}</Badge>
              {ctx.goal.targetPeriod && (
                <span className="text-xs text-muted-foreground">목표 시기 {ctx.goal.targetPeriod}</span>
              )}
              <span className="text-xs text-muted-foreground">
                기준 템플릿: {ctx.template.label}
              </span>
              {goalCompanies.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  희망 기업: {goalCompanies.join(", ")}
                </span>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        {/* 왼쪽: 스킬 + 근거 */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>스킬</CardTitle>
              <Link href="/career/skills" className="text-xs text-primary hover:underline">
                스킬 관리
              </Link>
            </CardHeader>
            <CardContent>
              <SkillList skills={ctx.skillScores} limit={8} />
              <p className="mt-3 text-xs text-muted-foreground">
                점수를 클릭하면 산출 근거가 보입니다. 점수는 스스로 매기는 것이 아니라 남긴 기록으로
                계산됩니다.
              </p>
            </CardContent>
          </Card>

          <ProfileImport />

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-1.5">
                <BookMarked className="h-4 w-4 text-muted-foreground" /> 근거가 되는 경험 (
                {ctx.evidence.length})
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <ImportEvidenceButton />
                <AddEvidenceDialog />
              </div>
            </CardHeader>
            <CardContent>
              {ctx.evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  아직 근거가 없습니다. 프로젝트·수상·활동을 추가하거나 기존 활동에서 가져오세요.
                </p>
              ) : (
                <ul className="divide-y">
                  {ctx.evidence.map((ev) => {
                    const skills = safeJsonParse<string[]>(ev.skills, []);
                    return (
                      <li key={ev.id} className="flex items-start gap-3 py-2.5">
                        <Badge variant="secondary" className="mt-0.5 shrink-0">
                          {EVIDENCE_KINDS[ev.kind as EvidenceKind] ?? ev.kind}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {ev.sourceType === "activity" && ev.sourceId ? (
                              <Link
                                href={`/activities/${ev.sourceId}`}
                                className="truncate text-sm font-medium hover:text-primary"
                              >
                                {ev.title}
                              </Link>
                            ) : (
                              <p className="truncate text-sm font-medium">{ev.title}</p>
                            )}
                            {ev.url && (
                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-muted-foreground hover:text-primary"
                                aria-label="원본 링크"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {ev.description && (
                            <p className="truncate text-xs text-muted-foreground">{ev.description}</p>
                          )}
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {skills.map((s) => `#${s}`).join(" ")} · {relativeTime(ev.createdAt)}
                          </p>
                        </div>
                        <DeleteEvidenceButton evidenceId={ev.id} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 점수 + 미션 + 부족한 부분 미리보기 */}
        <div className="space-y-4">
          <ProfileCompleteness
            hasGoal={Boolean(ctx.goal)}
            hasHeadline={Boolean(ctx.profile?.headline)}
            hasSummary={Boolean(ctx.profile?.summary)}
            skillCount={ctx.skillScores.length}
            evidenceCount={ctx.evidence.length}
            activityCount={activityCount}
            retrospectiveCount={retrospectiveCount}
            readiness={ctx.readiness}
          />
          <ReadinessCard
            readiness={ctx.readiness}
            templateLabel={ctx.template.label}
            trend={{ monthAgo: trend.monthAgo, latest: trend.latest ?? ctx.readiness.score }}
          />

          <MissionCard
            mission={ctx.mission}
            activeTask={
              ctx.activeAction
                ? { title: ctx.activeAction.title, taskId: ctx.activeAction.taskId }
                : null
            }
          />

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>가장 부족한 부분</CardTitle>
              <Link href="/career/gaps" className="text-xs text-primary hover:underline">
                전체 분석 <ArrowRight className="inline h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {ctx.gaps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  목표 수준을 모두 충족했습니다 🎉
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {ctx.gaps.slice(0, 4).map((gap) => (
                    <li key={gap.skill} className="flex items-center justify-between text-sm">
                      <span>{gap.skill}</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        -{gap.gap}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
