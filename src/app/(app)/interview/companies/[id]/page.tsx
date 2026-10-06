import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Play } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { installDataLoader } from "@/services/mock-interview/server-data";
import { COMPANY_Q_CATEGORIES, getCompany, loadCompanyQuestions } from "@/services/mock-interview/shared/companies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { safeHttpUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "기업 면접 질문" };

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const [, { id }] = await Promise.all([requireUser(), params]);
  const company = getCompany(id);
  if (!company) notFound();
  installDataLoader();
  const questions = await loadCompanyQuestions(company.id);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/interview/companies" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> 기업별 면접 질문
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{company.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {company.category} · {company.industry}
            </p>
          </div>
          <Link href={`/interview/new?company=${company.id}`} className={buttonVariants()}>
            <Play /> 이 기업으로 모의 면접
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>인재상·핵심가치</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {company.talent.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>알려진 전형</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-1 pl-4 text-sm">
              {company.process.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>면접 분위기와 준비 팁</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="leading-relaxed">{company.style}</p>
          {company.tips.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {company.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">자주 나온 질문 {questions.length}개</h2>
        {COMPANY_Q_CATEGORIES.map((cat) => {
          const list = questions.filter((q) => q.category === cat);
          if (!list.length) return null;
          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle>{cat}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {list.map((q) => (
                    <li key={q.text} className="flex gap-2">
                      <span className="mt-0.5 h-fit shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{q.basis === "후기" ? "후기" : "공식"}</span>
                      <span>
                        {q.text}
                        {q.track !== "공통" && <span className="ml-1 text-xs text-muted-foreground">({q.track})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="text-xs text-muted-foreground">
        <p className="mb-1">출처 (공개 자료):</p>
        <ul className="space-y-0.5">
          {company.sources.map((s) => {
            const href = safeHttpUrl(s.url);
            return (
              <li key={s.url}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:underline">
                    {s.title} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  s.title
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2">공개 후기·공식 자료를 바탕으로 다시 쓴 연습 질문입니다. 공식 문항이 아니며, 이 앱은 해당 기업과 관계가 없습니다.</p>
      </div>
    </div>
  );
}
