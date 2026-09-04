import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db, userSkills } from "@/lib/db";
import { getCareerContext } from "@/lib/career-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkillList } from "@/components/career/skill-list";
import { SkillManager } from "@/components/career/skill-manager";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const user = await requireUser();
  const [ctx, skills] = await Promise.all([
    getCareerContext(user.id),
    db.select().from(userSkills).where(eq(userSkills.userId, user.id)),
  ]);
  const targets = new Map(ctx.template.requirements.map((r) => [r.skill, r.target]));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/career"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Career Profile
        </Link>
        <h1 className="text-xl font-bold tracking-tight">스킬</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          스킬을 등록하고, 그 스킬을 쓴 경험을 연결하면 점수가 올라갑니다. 세로선은 목표(
          {ctx.template.label}) 수준입니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>스킬 점수 (근거 기반)</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillList skills={ctx.skillScores} targets={targets} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>스킬 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillManager skills={skills} studyField={ctx.studyField} />
        </CardContent>
      </Card>
    </div>
  );
}
