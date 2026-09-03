/**
 * 알림 설정 — 저장된 값을 안전하게 읽고, 시간 판단을 순수 함수로 둔다.
 * (DB 접근은 여기서 하지 않아 테스트하기 쉽다)
 */

import { NOTIFY_THRESHOLDS, NOTIFICATION_TYPES, type NotificationType } from "@/lib/constants";

export interface NotifySettings {
  /** 며칠 전에 알릴지 (내림차순) */
  thresholds: number[];
  /** 받을 알림 종류 */
  types: NotificationType[];
  /** 푸시를 보내지 않을 시간대 (없으면 항상 허용) */
  quietStart: number | null;
  quietEnd: number | null;
  weeklyReport: boolean;
  /** 0=일요일 */
  weeklyDay: number;
  /** UTC 기준 분 (한국 540) */
  timezoneOffset: number;
}

/** 고를 수 있는 임계일 */
export const THRESHOLD_CHOICES = [14, 7, 3, 1, 0] as const;

export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
  thresholds: [...NOTIFY_THRESHOLDS],
  types: Object.keys(NOTIFICATION_TYPES) as NotificationType[],
  quietStart: null,
  quietEnd: null,
  weeklyReport: true,
  weeklyDay: 0,
  timezoneOffset: 540,
};

interface RawSettings {
  notifyThresholds?: string | null;
  notifyTypes?: string | null;
  quietStart?: number | null;
  quietEnd?: number | null;
  weeklyReport?: number | null;
  weeklyDay?: number | null;
  timezoneOffset?: number | null;
}

/** 저장된 행을 설정으로 바꾼다. 값이 이상하면 기본값으로 되돌린다. */
export function parseNotifySettings(row: RawSettings | null | undefined): NotifySettings {
  if (!row) return { ...DEFAULT_NOTIFY_SETTINGS };

  const thresholds = parseNumberList(row.notifyThresholds)
    .filter((n) => (THRESHOLD_CHOICES as readonly number[]).includes(n))
    .sort((a, b) => b - a);

  const types = parseStringList(row.notifyTypes).filter(
    (t): t is NotificationType => t in NOTIFICATION_TYPES,
  );

  return {
    // 빈 배열은 "설정한 적 없음"이 아니라 "다 끔"일 수도 있으므로,
    // 저장된 값이 아예 없을 때만 기본값을 쓴다.
    thresholds: row.notifyThresholds ? thresholds : DEFAULT_NOTIFY_SETTINGS.thresholds,
    types: row.notifyTypes ? types : DEFAULT_NOTIFY_SETTINGS.types,
    quietStart: inHourRange(row.quietStart) ? row.quietStart! : null,
    quietEnd: inHourRange(row.quietEnd) ? row.quietEnd! : null,
    weeklyReport: row.weeklyReport === null || row.weeklyReport === undefined ? true : row.weeklyReport === 1,
    weeklyDay:
      typeof row.weeklyDay === "number" && row.weeklyDay >= 0 && row.weeklyDay <= 6 ? row.weeklyDay : 0,
    timezoneOffset:
      typeof row.timezoneOffset === "number" && Math.abs(row.timezoneOffset) <= 14 * 60
        ? row.timezoneOffset
        : 540,
  };
}

/** 지금이 조용한 시간인가 (자정을 넘기는 구간도 처리) */
export function isQuietHour(nowMs: number, settings: NotifySettings): boolean {
  const { quietStart, quietEnd } = settings;
  if (quietStart === null || quietEnd === null) return false;
  if (quietStart === quietEnd) return false; // 구간이 없으면 적용하지 않는다

  const hour = localParts(nowMs, settings.timezoneOffset).hour;
  return quietStart < quietEnd
    ? hour >= quietStart && hour < quietEnd
    : hour >= quietStart || hour < quietEnd; // 예: 22시~7시
}

/** 오늘이 주간 리포트를 보낼 요일인가 */
export function isWeeklyReportDay(nowMs: number, settings: NotifySettings): boolean {
  if (!settings.weeklyReport) return false;
  return localParts(nowMs, settings.timezoneOffset).weekday === settings.weeklyDay;
}

/** 사용자 시간대 기준 주차 키 (같은 주에 두 번 보내지 않기 위한 값) */
export function weekKey(nowMs: number, timezoneOffset: number): string {
  const { year, month, day } = localParts(nowMs, timezoneOffset);
  // 주의 시작(일요일)로 맞춘 날짜를 키로 쓴다
  const local = Date.UTC(year, month - 1, day);
  const weekday = new Date(local).getUTCDay();
  const start = new Date(local - weekday * 86400000);
  return start.toISOString().slice(0, 10);
}

/** UTC 시각을 사용자 시간대의 연·월·일·시·요일로 */
export function localParts(nowMs: number, timezoneOffset: number) {
  const shifted = new Date(nowMs + timezoneOffset * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
  };
}

function inHourRange(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23;
}

function parseNumberList(raw: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function parseStringList(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}
