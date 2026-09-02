"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

/** 구독 주소용 토큰을 발급(또는 재발급)한다. 재발급하면 기존 구독은 끊긴다. */
export async function issueCalendarToken(regenerate = false): Promise<string> {
  const user = await requireUser();
  if (user.calendarToken && !regenerate) return user.calendarToken;

  const token = randomBytes(24).toString("base64url");
  await db.update(users).set({ calendarToken: token }).where(eq(users.id, user.id));
  return token;
}
