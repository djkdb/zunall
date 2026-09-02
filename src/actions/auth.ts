"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { newId } from "@/lib/utils";

export type AuthFormState = { error?: string } | undefined;

/**
 * DB 설정이 안 된 배포에서 서버 예외로 흰 화면이 뜨는 대신,
 * 폼 위에 원인을 보여준다. (redirect()가 던지는 제어 흐름 예외는 그대로 통과)
 */
function dbErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("DATABASE_URL")) {
    return message;
  }
  if (/relation .* does not exist/i.test(message)) {
    return "데이터베이스에 테이블이 없습니다. schema.sql 을 DB에 적용해주세요. (상태 확인: /api/health)";
  }
  return `데이터베이스 오류로 처리하지 못했습니다. 잠시 후 다시 시도해주세요. (상태 확인: /api/health)`;
}

const signupSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요.").max(50),
  email: z.string().trim().toLowerCase().email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(100),
});

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { name, email, password } = parsed.data;

  const id = newId();
  try {
    const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (existing) {
      return { error: "이미 가입된 이메일입니다." };
    }
    await db.insert(users)
      .values({ id, email, name, passwordHash: hashPassword(password), createdAt: Date.now() });
    await createSession(id);
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
  redirect("/");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, password } = parsed.data;

  try {
    const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (!user || !user.passwordHash) {
      // 구글로만 가입한 계정은 비밀번호가 없다
      if (user?.googleId) {
        return { error: "구글로 가입한 계정입니다. 아래 '구글로 계속하기'를 눌러주세요." };
      }
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    await createSession(user.id);
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
