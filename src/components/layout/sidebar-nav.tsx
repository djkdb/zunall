"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Bell,
  BarChart3,
  Settings,
  Compass,
  Crosshair,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function SidebarNav({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/", label: "대시보드", icon: LayoutDashboard },
    { href: "/career", label: "커리어", icon: Compass },
    { href: "/opportunities", label: "기회", icon: Crosshair },
    { href: "/activities", label: "활동", icon: FolderKanban },
    { href: "/calendar", label: "캘린더", icon: CalendarDays },
    { href: "/notifications", label: "알림", icon: Bell, badge: unreadCount },
    { href: "/portfolio", label: "포트폴리오", icon: BookMarked },
    { href: "/stats", label: "통계", icon: BarChart3 },
    { href: "/settings", label: "설정", icon: Settings },
  ];

  return (
    <nav className="flex flex-1 flex-col gap-0.5 md:mt-4">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="ml-auto hidden rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground md:inline">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
