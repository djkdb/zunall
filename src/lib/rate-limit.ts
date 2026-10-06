import "server-only";
import { headers } from "next/headers";
import { eq, lt, sql } from "drizzle-orm";
import { db, rateLimits } from "@/lib/db";

/**
 * 남용 방지 카운터.
 *
 * 열려 있는 서비스는 비밀번호 대입(같은 이메일에 수백 번 로그인), 재설정 메일 폭탄,
 * 봇이 "둘러보기"를 눌러 계정을 수천 개 만드는 일을 막아야 한다.
 * key 마다 고정 창 하나를 두고 그 안의 횟수만 센다 (DB 한 번 왕복, 원자적).
 */

export interface Limit {
  /** 창 안에서 허용하는 횟수 */
  max: number;
  windowMs: number;
}

export const LIMITS = {
  /** 같은 이메일로 로그인 실패 — 15분에 5번 */
  loginEmail: { max: 5, windowMs: 15 * 60_000 },
  /** 같은 IP 에서 로그인 실패 — 15분에 30번 (여러 계정을 돌아가며 대입하는 경우) */
  loginIp: { max: 30, windowMs: 15 * 60_000 },
  /** 같은 이메일로 재설정 메일 — 1시간에 3번 */
  resetEmail: { max: 3, windowMs: 60 * 60_000 },
  /** 같은 IP 에서 가입 — 1시간에 20번 */
  signupIp: { max: 20, windowMs: 60 * 60_000 },
  /** 같은 IP 에서 둘러보기 계정 — 1시간에 10번 */
  demoIp: { max: 10, windowMs: 60 * 60_000 },
  /** 의견 보내기 — 1시간에 10번 */
  feedback: { max: 10, windowMs: 60 * 60_000 },
} as const satisfies Record<string, Limit>;

/** 한 번 센다. 이번 것까지 포함한 횟수가 한도를 넘으면 false */
export async function consume(key: string, limit: Limit, now = Date.now()): Promise<boolean> {
  const stale = now - limit.windowMs;
  const rows = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} < ${stale} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimits.windowStart} < ${stale} THEN ${now} ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({ count: rateLimits.count });
  return (rows[0]?.count ?? 1) <= limit.max;
}

/** 세지 않고 이미 한도에 닿았는지만 본다 (로그인: 실패만 세고, 막혔으면 비밀번호를 확인하지도 않는다) */
export async function isBlocked(key: string, limit: Limit, now = Date.now()): Promise<boolean> {
  const row = (await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1))[0];
  if (!row || row.windowStart < now - limit.windowMs) return false;
  return row.count >= limit.max;
}

export async function reset(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

/** 하루 지난 카운터 정리 (크론) */
export async function pruneRateLimits(now = Date.now()): Promise<void> {
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, now - 86400000));
}

/**
 * 요청한 사람의 IP. Cloudflare 가 붙여 주는 값만 믿는다 —
 * X-Forwarded-For 는 누구나 적어 보낼 수 있어서, 그걸 믿으면 매번 다른 IP 인 척할 수 있다.
 * (Cloudflare 밖에서 돌 때는 null → IP 기준 제한은 건너뛰고 이메일 기준 제한만 건다)
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("cf-connecting-ip")?.trim();
  return ip && ip.length <= 64 ? ip : null;
}

export function ipFromRequest(request: Request): string | null {
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  return ip && ip.length <= 64 ? ip : null;
}

export const BLOCKED_MESSAGE = {
  login: "로그인 시도가 너무 많습니다. 15분 뒤에 다시 시도하거나 비밀번호를 재설정해 주세요.",
  reset: "재설정 메일을 너무 자주 요청했습니다. 1시간 뒤에 다시 시도해 주세요.",
  signup: "짧은 시간에 가입이 너무 많았습니다. 잠시 후 다시 시도해 주세요.",
} as const;
