import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { PrintButton } from "@/components/portfolio/print-button";
import { PortfolioDocument } from "@/components/portfolio/portfolio-document";
import { ShareLinkCard } from "@/components/portfolio/share-link-card";

export const metadata: Metadata = { title: "포트폴리오" };

/**
 * 포트폴리오 한 장.
 * 이미 쌓인 활동 기록·회고를 인쇄용 레이아웃으로 모아 보여준다.
 * 브라우저의 '인쇄 → PDF로 저장' 으로 그대로 파일이 된다.
 */
export default async function PortfolioPage() {
  // 로그인 확인이 사용자 행 전체를 돌려주므로 공유 토큰을 다시 묻지 않는다
  const user = await requireUser();

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

      <div className="print:hidden">
        <ShareLinkCard token={user.portfolioToken ?? null} />
      </div>

      <PortfolioDocument userId={user.id} />
    </div>
  );
}
