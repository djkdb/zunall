"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkPendingBar } from "@/components/ui/link-pending";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isActivePath, navItems } from "@/components/layout/sidebar-nav";
import { FeedbackButton } from "@/components/layout/feedback-button";

/** 하단 탭에 바로 두는 메뉴 (나머지는 "전체"에) */
const PRIMARY = ["/", "/career", "/activities", "/interview"];
const SHORT_LABEL: Record<string, string> = { "/": "홈", "/interview": "면접" };

/**
 * 휴대폰 화면의 하단 탭.
 * 아이콘만 세로로 13개 늘어놓은 막대로는 무엇이 어디 있는지 알 수 없었다.
 * 자주 쓰는 4개는 이름과 함께 아래에, 나머지는 "전체"에 모은다.
 */
export function MobileNav({
  unreadCount,
  showAdmin = false,
  logoutAction,
  userName,
}: {
  unreadCount: number;
  showAdmin?: boolean;
  logoutAction: () => Promise<void>;
  userName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const items = navItems(unreadCount, showAdmin);
  const primary = PRIMARY.map((href) => items.find((i) => i.href === href)!).filter(Boolean);
  const rest = items.filter((i) => !PRIMARY.includes(i.href));
  const restActive = rest.some((i) => isActivePath(pathname, i.href));

  // 다른 화면으로 가면 닫는다
  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
      {open && (
        <div
          id="mobile-more"
          role="dialog"
          aria-label="전체 메뉴"
          className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t bg-card p-4 shadow-2xl md:hidden"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">{userName}님</p>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <form action={logoutAction}>
                <button type="submit" className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent" aria-label="로그아웃">
                  <LogOut className="h-4 w-4" /> 로그아웃
                </button>
              </form>
            </div>
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {rest.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs",
                    isActivePath(pathname, item.href) ? "border-primary bg-primary/5 text-primary" : "hover:bg-accent",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                  <LinkPendingBar />
                </Link>
              </li>
            ))}
            <li>
              <FeedbackButton variant="tile" />
            </li>
          </ul>
        </div>
      )}

      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid h-14 grid-cols-5">
          {primary.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-full flex-col items-center justify-center gap-0.5 text-[11px]", active ? "font-semibold text-primary" : "text-muted-foreground")}
                >
                  <item.icon className="h-5 w-5" />
                  {SHORT_LABEL[item.href] ?? item.label}
                  <LinkPendingBar />
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-more"
              aria-label={unreadCount > 0 ? `전체 메뉴 (읽지 않은 알림 ${unreadCount}개)` : "전체 메뉴"}
              className={cn("relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px]", open || restActive ? "font-semibold text-primary" : "text-muted-foreground")}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              전체
              {unreadCount > 0 && !open && <span className="absolute right-[30%] top-2 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
