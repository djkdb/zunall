import Link from "next/link";
import { CaveroMark } from "@/components/brand/logo";

/** 로그인 없이도 볼 수 있는 문서 화면 (약관·개인정보처리방침) */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/30 py-10 dark:bg-background">
      <div className="mx-auto max-w-2xl px-4">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <CaveroMark className="h-7 w-7 text-[#0F2338] dark:text-foreground" />
          <span className="text-base font-bold tracking-[0.18em]">CAVERO</span>
        </Link>

        <article className="prose-cavero rounded-lg border bg-card p-6 text-sm leading-relaxed shadow-sm">
          {children}
        </article>

        <nav className="mt-4 flex gap-4 text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            개인정보처리방침
          </Link>
          <Link href="/login" className="hover:text-foreground">
            로그인
          </Link>
        </nav>
      </div>
    </div>
  );
}
