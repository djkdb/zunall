import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cavero — AI Career OS",
    template: "%s · Cavero",
  },
  description:
    "공모전·대외활동·인턴을 한 흐름으로 관리하고, 목표 직무 기준으로 다음에 무엇을 할지 설계해주는 AI Career OS",
};

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
