import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db, careerGoals, careerProfiles } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { DOMAINS, ROLE_GROUPS, domainsInGroup, rolesInDomain, searchRoles } from "@/services/mock-interview/shared/roles";
import { suggestRole } from "@/services/mock-interview/catalog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "직무별 면접 질문" };

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [user, { q }] = await Promise.all([requireUser(), searchParams]);
  const query = (q ?? "").trim().slice(0, 40);
  const [profile, goal] = await Promise.all([
    db.select({ roleKey: careerProfiles.roleKey }).from(careerProfiles).where(eq(careerProfiles.userId, user.id)).limit(1),
    db
      .select({ name: careerGoals.name })
      .from(careerGoals)
      .where(and(eq(careerGoals.userId, user.id), eq(careerGoals.isActive, 1)))
      .limit(1),
  ]);
  const mine = suggestRole(profile[0]?.roleKey, goal[0]?.name);
  const matches = query ? searchRoles(query, 20) : [];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/interview" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> 모의 면접
        </Link>
        <h1 className="text-xl font-bold tracking-tight">직무별 면접 질문</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          직무마다 실제로 무엇을 묻는지, 어떤 역량을 보는지 미리 봅니다. 공개 후기·공식 자료에서 온 질문과 직무 기반 연습 질문을 구분해 표시합니다.
        </p>
      </div>

      <form className="flex gap-2" action="/interview/roles">
        <label htmlFor="role-q" className="sr-only">
          직무 검색
        </label>
        <Input id="role-q" name="q" defaultValue={query} placeholder="예: 간호사, 회계, 마케팅, 학예사, 백엔드" />
        <Button type="submit" variant="outline">
          <Search /> 찾기
        </Button>
      </form>

      {mine?.roleId && !query && (
        <p className="text-sm">
          내 목표 직무:{" "}
          <Link href={`/interview/roles/${mine.roleId}`} className="font-medium text-primary hover:underline">
            {mine.position} 면접 질문 보기
          </Link>
        </p>
      )}

      {query ? (
        matches.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {matches.map((m) => (
              <li key={m.role.id}>
                <Link href={`/interview/roles/${m.role.id}`} className="block rounded-lg border p-3 hover:bg-accent/50">
                  <p className="text-sm font-medium">{m.role.ko}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.domain.name} › {m.family.name}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">&lsquo;{query}&rsquo;에 맞는 직무를 찾지 못했습니다. 다른 이름으로 찾아보거나, 모의 면접에서 직무 이름을 직접 적어 시작할 수 있습니다.</p>
        )
      ) : (
        <div className="space-y-4">
          {ROLE_GROUPS.map((g) => {
            const domains = domainsInGroup(g.id).filter((d) => DOMAINS.includes(d));
            if (!domains.length) return null;
            return (
              <section key={g.id} className="space-y-2">
                <h2 className="text-sm font-semibold">{g.name}</h2>
                <div className="space-y-1.5">
                  {domains.map((d) => (
                    <p key={d.id} className="text-sm leading-relaxed">
                      <span className="mr-2 text-xs text-muted-foreground">{d.name}</span>
                      {rolesInDomain(d.id).map((r, i) => (
                        <span key={r.id}>
                          {i > 0 && <span className="text-muted-foreground"> · </span>}
                          <Link href={`/interview/roles/${r.id}`} className="hover:text-primary hover:underline">
                            {r.ko}
                          </Link>
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
