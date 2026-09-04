import "server-only";
import { and, eq } from "drizzle-orm";
import { db, aiUsage } from "@/lib/db";
import { newId } from "@/lib/utils";

/**
 * 하루 AI 호출 상한.
 * 실제 API 키를 붙이는 순간 비용이 무제한으로 열린다.
 * 사용자 한 명이 실수로(또는 일부러) 수백 번 돌려도 감당할 수 있게 막는다.
 */

/** 0 이하이거나 설정하지 않으면 제한하지 않는다 */
export function dailyLimit(): number {
  const raw = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/** 서버 기준 오늘 (UTC) */
export function usageDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export interface UsageState {
  used: number;
  limit: number;
  /** 제한이 걸려 있고 이미 다 썼는가 */
  exceeded: boolean;
}

export async function getUsage(userId: string, now = Date.now()): Promise<UsageState> {
  const limit = dailyLimit();
  if (limit === 0) return { used: 0, limit: 0, exceeded: false };

  const row = (
    await db
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, usageDay(now))))
      .limit(1)
  )[0];

  const used = row?.count ?? 0;
  return { used, limit, exceeded: used >= limit };
}

/**
 * 한 번 쓴 것으로 기록한다.
 * 제한이 없으면 기록도 하지 않는다 (쓰지 않을 값을 쌓아둘 이유가 없다).
 */
export async function recordUsage(userId: string, now = Date.now()): Promise<void> {
  if (dailyLimit() === 0) return;

  const day = usageDay(now);
  const row = (
    await db
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)))
      .limit(1)
  )[0];

  if (row) {
    await db
      .update(aiUsage)
      .set({ count: row.count + 1, updatedAt: now })
      .where(eq(aiUsage.id, row.id));
  } else {
    await db.insert(aiUsage).values({ id: newId(), userId, day, count: 1, updatedAt: now });
  }
}

/** 화면·오류 메시지용 안내 문구 */
export function limitMessage(state: UsageState): string {
  return `오늘 AI 사용 횟수를 모두 썼습니다 (${state.used}/${state.limit}회). 내일 다시 사용할 수 있습니다.`;
}
