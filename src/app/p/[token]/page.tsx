import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { CaveroMark } from "@/components/brand/logo";
import { PortfolioDocument } from "@/components/portfolio/portfolio-document";

/** 주소를 아는 사람만 보는 페이지 — 검색에 걸리지 않게 막는다 */
export const metadata: Metadata = {
  title: "포트폴리오",
  robots: { index: false, follow: false },
};

export default async function SharedPortfolioPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const owner = (
    await db.select().from(users).where(eq(users.portfolioToken, token)).limit(1)
  )[0];
  // 토큰이 없거나 공유를 중지했으면 존재 자체를 알리지 않는다
  if (!owner) notFound();

  return (
    <div className="min-h-screen bg-secondary/30 py-8 dark:bg-background">
      <div className="mx-auto max-w-3xl px-4">
        <PortfolioDocument userId={owner.id} />

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground print:hidden">
          <CaveroMark className="h-4 w-4 text-[#0F2338] dark:text-foreground" />
          <Link href="/" className="hover:text-foreground hover:underline">
            Cavero 로 정리한 포트폴리오
          </Link>
        </p>
      </div>
    </div>
  );
}
