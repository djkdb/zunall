import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

/** 오늘 날짜를 로컬 기준 YYYY-MM-DD 문자열로 */
export function todayStr(): string {
  const d = new Date();
  return toDateStr(d);
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → 로컬 자정 Date */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * D-day 계산. 양수 = 남은 일수, 0 = 오늘, 음수 = 지난 일수.
 * 잘못된 입력이면 null.
 */
export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = parseDateStr(dateStr.slice(0, 10));
  if (isNaN(target.getTime())) return null;
  const now = parseDateStr(todayStr());
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export function ddayLabel(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "D-Day";
  if (days > 0) return `D-${days}`;
  return `D+${-days}`;
}

/** 마감 임박도에 따른 색상 클래스 (🔴 D-1 이하, 🟠 D-3, 🟡 D-7, 🟢 여유) */
export function ddayColorClass(days: number | null): string {
  if (days === null) return "text-muted-foreground";
  if (days < 0) return "text-muted-foreground";
  if (days <= 1) return "text-rose-600 dark:text-rose-400";
  if (days <= 3) return "text-orange-500 dark:text-orange-400";
  if (days <= 7) return "text-amber-500 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

export function ddayDotClass(days: number | null): string {
  if (days === null || days < 0) return "bg-zinc-300 dark:bg-zinc-600";
  if (days <= 1) return "bg-rose-500";
  if (days <= 3) return "bg-orange-500";
  if (days <= 7) return "bg-amber-400";
  return "bg-emerald-500";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "-";
  const d = parseDateStr(s.slice(0, 10));
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return formatDate(toDateStr(new Date(ts)));
}

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

/** JSON.parse를 안전하게 수행, 실패 시 fallback */
export function safeJsonParse<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
