import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, mockInterviews } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSetupContext, companyFromText } from "@/lib/mock-interview-queries";
import { companyOptions, roleOptions, suggestRole } from "@/services/mock-interview/catalog";
import { getRole } from "@/services/mock-interview/shared/roles";
import { getCompany } from "@/services/mock-interview/shared/companies";
import { getProviderName } from "@/services/ai/provider";
import type { Interview } from "@/services/mock-interview/types";
import { SetupForm, type SetupDefaults } from "@/components/mock-interview/setup-form";

export const metadata: Metadata = { title: "모의 면접 준비" };

export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; company?: string; role?: string; from?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const [ctx, previous] = await Promise.all([
    getSetupContext(user.id),
    params.from
      ? db
          .select({ data: mockInterviews.data, activityId: mockInterviews.activityId })
          .from(mockInterviews)
          .where(and(eq(mockInterviews.id, params.from), eq(mockInterviews.userId, user.id)))
          .limit(1)
          .then((r) => r[0])
      : Promise.resolve(undefined),
  ]);

  const activity = ctx.activities.find((a) => a.id === (params.activity ?? previous?.activityId)) ?? null;
  const suggestion = suggestRole(ctx.roleKey, ctx.goalName);
  const role = getRole(params.role);

  let defaults: SetupDefaults = {
    roleId: role?.id ?? suggestion?.roleId ?? null,
    position: role?.ko ?? suggestion?.position ?? "",
    companyId: getCompany(params.company)?.id ?? (activity ? companyFromText(`${activity.name} ${activity.organizer ?? ""}`) : null),
    companyTrack: null,
    activityId: activity?.id ?? null,
    interviewType: "mixed",
    difficulty: "normal",
    questionLimit: 5,
    experience: "entry",
    persona: "professional",
    useEssays: Boolean(activity?.hasEssays),
    useProfile: false,
    voiceEnabled: false,
  };

  // "같은 설정으로 다시 보기"
  if (previous) {
    try {
      const c = (JSON.parse(previous.data) as Interview).config;
      defaults = {
        ...defaults,
        roleId: c.roleId ?? null,
        position: c.position,
        companyId: c.companyId ?? null,
        companyTrack: c.companyTrack ?? null,
        interviewType: c.interviewType,
        difficulty: c.difficulty,
        questionLimit: Math.min(10, c.questionLimit),
        experience: c.experience,
        persona: c.persona,
        voiceEnabled: c.voiceEnabled,
      };
    } catch {
      // 깨진 기록이면 기본값으로
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/interview" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> 모의 면접
        </Link>
        <h1 className="text-xl font-bold tracking-tight">모의 면접 준비</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          3인 면접관이 질문하고, 답을 듣고 꼬리질문으로 파고듭니다. 끝나면 항목별 점수와 문답별 피드백을 드립니다.
        </p>
      </div>
      <SetupForm
        roles={roleOptions()}
        companies={companyOptions()}
        activities={ctx.activities.map(({ id, name, hasEssays, hasNotice }) => ({ id, name, hasEssays, hasNotice }))}
        defaults={defaults}
        aiReal={getProviderName() !== "mock"}
        hasEvidence={ctx.hasEvidence}
      />
    </div>
  );
}
