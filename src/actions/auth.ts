"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { newId } from "@/lib/utils";

export type AuthFormState = { error?: string } | undefined;

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

  const existing = await db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    return { error: "이미 가입된 이메일입니다." };
  }

  const id = newId();
  await db.insert(users)
    .values({ id, email, name, passwordHash: hashPassword(password), createdAt: Date.now() })
    .run();
  await createSession(id);
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

  const user = await db.select().from(users).where(eq(users.email, email)).get();
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  await createSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
