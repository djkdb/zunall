import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Play } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { installDataLoader } from "@/services/mock-interview/server-data";
import { getRole, roleContextFor } from "@/services/mock-interview/shared/roles";
import { fillRole, loadRoleProfile, questionPool } from "@/services/mock-interview/shared/roleBank";
import { blueprintFor } from "@/services/mock-interview/shared/blueprints";
import type { RoleQuestion } from "@/services/mock-interview/shared/roleTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "직무 면접 질문" };

const BASIS_LABEL: Record<string, string> = { 공개후기: "후기", 공식자료: "공식", 공고기반: "공고", 직무기반: "직무", 일반면접: "공통" };
/** 한 분류에 보여 줄 최대 질문 수 (전부 보여 주면 수백 개가 된다) */
const PER_CATEGORY = 8;

export default async function RoleQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const [, { id }] = await Promise.all([requireUser(), params]);
  const role = getRole(id);
  if (!role) notFound();
  installDataLoader();
  const ctx = roleContextFor({ position: role.ko, roleId: role.id });
  const [pool, profile] = await Promise.all([questionPool(ctx).catch(() => [] as RoleQuestion[]), loadRoleProfile(ctx).catch(() => null)]);
  const bp = blueprintFor(ctx.archetype);

  // 이 직무 고유 질문을 먼저, 출처가 있는 질문을 먼저
  const own = (q: RoleQuestion) => (q.scope === `role:${role.id}` ? 0 : q.scope.startsWith("family:") ? 1 : q.scope.startsWith("domain:") ? 2 : 3);
  const sourced = (q: RoleQuestion) => (q.basis === "공개후기" || q.basis === "공식자료" || q.basis === "공고기반" ? 0 : 1);
  const sorted = [...pool].filter((q) => q.scope !== "common").sort((a, b) => own(a) - own(b) || sourced(a) - sourced(b));
  const byCategory = new Map<string, RoleQuestion[]>();
  for (const q of sorted) {
    const list = byCategory.get(q.category) ?? [];
    if (list.length < PER_CATEGORY) list.push(q);
    byCategory.set(q.category, list);
  }
  const reported = pool.filter((q) => q.basis === "공개후기" || q.basis === "공식자료" || q.basis === "공고기반").length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/interview/roles" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> 직무별 면접 질문
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{role.ko} 면접 질문</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {ctx.domain?.name} › {ctx.family?.name} · 연습 질문 {pool.length}개 (출처 있는 질문 {reported}개)
            </p>
          </div>
          <Link href={`/interview/new?role=${role.id}`} className={buttonVariants()}>
            <Play /> 이 직무로 모의 면접
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {profile && profile.skills.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>면접관이 보는 역량</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{profile.skills.join(" · ")}</p>
              <p className="text-xs text-muted-foreground">
                이 직무 답변에서 특히 보는 것: <b className="text-foreground">{bp.signal.label.ko}</b>
              </p>
            </CardContent>
          </Card>
        )}
        {profile && (profile.responsibilities.length > 0 || profile.topics.scenario.length > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>실제로 하는 일·자주 나오는 상황</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {[...profile.responsibilities.slice(0, 4), ...profile.topics.scenario.slice(0, 3)].map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>꼬리질문은 이렇게 이어집니다</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ol className="flex flex-wrap gap-x-2 gap-y-1">
            {bp.chain.map((c, i) => (
              <li key={c.key} className="text-muted-foreground">
                {i > 0 && "→ "}
                <span className="text-foreground">{c.ask.ko}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <section className="space-y-3">
        {[...byCategory.entries()].map(([cat, list]) => (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle>{cat}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {list.map((q) => (
                  <li key={q.text} className="flex gap-2">
                    <span className="mt-0.5 h-fit shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{BASIS_LABEL[q.basis] ?? q.basis}</span>
                    <span>{fillRole(q.text, role.ko)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">
        &lsquo;후기·공식·공고&rsquo;는 공개 면접 후기·공식 채용 자료·채용 공고를 바탕으로 다시 쓴 질문이고, &lsquo;직무&rsquo;는 이 직무의 실제 업무를 바탕으로 만든 연습 질문입니다. 기출 문제가 아닙니다.
      </p>
    </div>
  );
}
