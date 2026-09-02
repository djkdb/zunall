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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
