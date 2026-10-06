import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { appOrigin } from "@/lib/app-url";
import "./globals.css";

const DESCRIPTION =
  "공모전·대외활동·인턴·채용 공고 정리부터 지원 판단, 자기소개서 첨삭, AI 모의 면접까지. 대학생 취업 준비를 한 곳에서.";

/**
 * 카카오톡·슬랙·검색 결과에 링크를 붙였을 때 보이는 미리보기.
 * 이미지 주소가 절대 주소여야 해서, 지금 열려 있는 주소를 기준으로 만든다.
 */
export async function generateMetadata(): Promise<Metadata> {
  const origin = await appOrigin();
  return {
    metadataBase: new URL(origin),
    title: {
      default: "Cavero — 지원할 곳 고르기부터 모의 면접까지",
      template: "%s · Cavero",
    },
    description: DESCRIPTION,
    applicationName: "Cavero",
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "Cavero",
      title: "Cavero — 지원할 곳 고르기부터 모의 면접까지",
      description: DESCRIPTION,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Cavero — 대학생 취업 준비, 공고 정리부터 AI 모의 면접까지" }],
    },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen">
        {/*
          next-themes 는 함수를 문자열로 바꿔 인라인 <script> 로 심는다.
          Cloudflare 빌드(esbuild --keep-names)를 거치면 그 문자열 안에
          `__name(...)` 호출이 섞여 들어가는데 브라우저에는 그 도우미가 없어
          "__name is not defined" 로 스크립트가 통째로 죽는다.
          같은 역할을 하는 도우미를 먼저 정의해 테마 스크립트가 살아 있게 한다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__name=window.__name||function(t,v){try{Object.defineProperty(t,'name',{value:v,configurable:true})}catch(e){}return t};",
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
