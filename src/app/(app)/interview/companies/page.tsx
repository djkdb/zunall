import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { COMPANIES, COMPANY_CATEGORIES, talentKeyword } from "@/services/mock-interview/shared/companies";

export const metadata: Metadata = { title: "기업별 면접 질문" };

export default async function CompaniesPage() {
  await requireUser();
  return (
    <div className="space-y-5">
      <div>
        <Link href="/interview" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> 모의 면접
        </Link>
        <h1 className="text-xl font-bold tracking-tight">기업별 면접 질문</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          공개 면접 후기와 공식 채용 자료를 바탕으로 정리한 인재상·전형·자주 나온 질문입니다. 공식 문항이 아니며 해당 기업과 관계가 없습니다.
        </p>
      </div>
      {COMPANY_CATEGORIES.map((cat) => {
        const list = COMPANIES.filter((c) => c.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="space-y-2">
            <h2 className="text-sm font-semibold">{cat}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => (
                <li key={c.id}>
                  <Link href={`/interview/companies/${c.id}`} className="block h-full rounded-lg border p-3 hover:bg-accent/50">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.industry} · 질문 {c.questionCount}개
                    </p>
                    {c.talent.length > 0 && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">인재상: {c.talent.slice(0, 3).map(talentKeyword).join(", ")}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
