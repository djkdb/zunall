import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Bell, LogOut } from "lucide-react";
import { CaveroMark } from "@/components/brand/logo";
import { requireUser } from "@/lib/auth/session";
import { db, notifications } from "@/lib/db";
import { logout } from "@/actions/auth";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { FeedbackButton } from "@/components/layout/feedback-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ensureDeadlineNotifications } from "@/services/notification/generator";
import { DemoBanner } from "@/components/layout/demo-banner";
import { isDemoEmail } from "@/services/demo/seed";
import { isAdmin } from "@/lib/admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // 마감 알림 생성(10분에 한 번)과 미읽음 개수를 함께 처리한다.
  // 화면 이동마다 순서대로 기다리면 그만큼 느려진다.
  const [, unreadRows] = await Promise.all([
    ensureDeadlineNotifications(user.id),
    db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, 0))),
  ]);
  const unread = unreadRows.length;

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r bg-card px-3 py-4 md:flex">
        <Link href="/" className="flex items-center gap-2 px-2 py-1">
          <CaveroMark className="h-7 w-7 text-[#0F2338] dark:text-foreground" />
          <span className="hidden text-base font-bold tracking-[0.18em] md:inline">CAVERO</span>
        </Link>

        <SidebarNav unreadCount={unread} showAdmin={isAdmin(user.email)} />

        <div className="mt-auto flex flex-col gap-2">
          <FeedbackButton />
          <div className="hidden items-center justify-between px-2 md:flex">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-1 px-1">
            <ThemeToggle />
            <form action={logout}>
              <button
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="로그아웃"
                title="로그아웃"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* 휴대폰: 위에는 로고, 아래에는 탭 */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <CaveroMark className="h-6 w-6 text-[#0F2338] dark:text-foreground" />
          <span className="text-sm font-bold tracking-[0.18em]">CAVERO</span>
        </Link>
        <Link href="/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" aria-label={`알림${unread ? ` (읽지 않음 ${unread}개)` : ""}`}>
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-1 top-1 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
        </Link>
      </header>

      <main className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:ml-56 md:pb-0">
        {isDemoEmail(user.email) && <DemoBanner />}
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">{children}</div>
      </main>

      <MobileNav unreadCount={unread} showAdmin={isAdmin(user.email)} logoutAction={logout} userName={user.name} />
    </div>
  );
}
