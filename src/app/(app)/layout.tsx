import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Sparkles, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db, notifications } from "@/lib/db";
import { logout } from "@/actions/auth";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ensureDeadlineNotifications } from "@/services/notification/generator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // 접속 시점에 D-day 알림 생성 (중복 방지 내장)
  await ensureDeadlineNotifications(user.id);

  const unread = (await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, 0)))
    .all()).length;

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-14 flex-col border-r bg-card px-2 py-4 md:w-56 md:px-3">
        <Link href="/" className="flex items-center gap-2 px-2 py-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="hidden text-base font-bold tracking-tight md:inline">Zunall</span>
        </Link>

        <SidebarNav unreadCount={unread} />

        <div className="mt-auto flex flex-col gap-2">
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

      <main className="ml-14 flex-1 md:ml-56">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}
