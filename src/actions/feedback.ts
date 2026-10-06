"use server";

import { z } from "zod";
import { db, feedback } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { newId } from "@/lib/utils";
import { LIMITS, consume } from "@/lib/rate-limit";

/**
 * 의견 보내기. 베타 서비스는 쓰는 사람의 한 줄이 가장 좋은 지표다.
 * 답장 받기를 고른 경우에만 이메일을 함께 남긴다.
 */
const schema = z.object({
  kind: z.enum(["bug", "idea", "praise", "other"]),
  message: z.string().trim().min(2, "내용을 적어 주세요.").max(1000, "1000자까지 적을 수 있습니다."),
  page: z.string().max(200).optional(),
  wantsReply: z.boolean().default(false),
});

export async function sendFeedback(input: z.input<typeof schema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "내용을 확인해 주세요." };
  if (!(await consume(`feedback:${user.id}`, LIMITS.feedback))) {
    return { ok: false, error: "의견을 짧은 시간에 너무 많이 보냈습니다. 잠시 뒤에 다시 보내 주세요." };
  }
  // 경로만 남긴다 (쿼리 문자열에 개인 정보가 섞일 수 있다)
  const page = parsed.data.page?.split("?")[0].replace(/[^\w/\-[\]]/g, "").slice(0, 120) || null;
  await db.insert(feedback).values({
    id: newId(),
    userId: user.id,
    kind: parsed.data.kind,
    message: parsed.data.message,
    page,
    replyEmail: parsed.data.wantsReply ? user.email : null,
    createdAt: Date.now(),
  });
  return { ok: true };
}
