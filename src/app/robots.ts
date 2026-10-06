import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/app-url";

export const dynamic = "force-dynamic";

/**
 * 검색엔진 안내. 소개·약관·공유된 포트폴리오만 열어 두고,
 * 둘러보기(/demo — 열 때마다 임시 계정이 생긴다)와 API 는 따라오지 않게 한다.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await appOrigin();
  return {
    rules: [{ userAgent: "*", allow: ["/", "/welcome", "/terms", "/privacy", "/p/"], disallow: ["/demo", "/api/", "/share", "/reset/", "/forgot"] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
