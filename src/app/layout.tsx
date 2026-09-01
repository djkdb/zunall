import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Zunall — 대외활동 OS",
    template: "%s · Zunall",
  },
  description:
    "공모전·대외활동·해커톤을 프로젝트 단위로 관리하고, AI가 제출물을 평가 기준에 맞춰 분석해주는 개인용 대외활동 OS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
