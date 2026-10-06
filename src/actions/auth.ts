"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { newId } from "@/lib/utils";
import { BLOCKED_MESSAGE, LIMITS, clientIp, consume, isBlocked, reset } from "@/lib/rate-limit";

export type AuthFormState = { error?: string } | undefined;

/**
 * 없는 계정에도 비밀번호 확인을 한 번 돌리기 위한 해시. 버린 무작위 문자열의 해시라 어떤 비밀번호와도 맞지 않는다.
 * (서버가 뜰 때마다 계산하면 Workers 첫 요청이 그만큼 느려져서 미리 만들어 둔 값을 쓴다)
 */
const DUMMY_HASH = "scrypt$3576a73093bc0bbf40b8c240068d135d$a65e76ad00e478fa254b270514c4c53f6cb18edbd4764bffc56a8909311631165d89658a1383d539a101ce0e3a772d3ffa0d67d437f5b0a54b65a868c49cccbf";

/**
 * 로그인 뒤 돌아갈 주소.
 * 다른 사이트로 튕기지 않도록 앱 안의 경로만 허용한다.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

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
  // 화면의 체크박스는 required 지만, 서버에서도 한 번 더 확인한다.
  agree: z.literal("1", { message: "이용약관과 개인정보처리방침에 동의해주세요." }),
});

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    agree: formData.get("agree"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { name, email, password } = parsed.data;

  const id = newId();
  try {
    const ip = await clientIp();
    if (ip && !(await consume(`signup-ip:${ip}`, LIMITS.signupIp))) return { error: BLOCKED_MESSAGE.signup };
    const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (existing) {
      return { error: "이미 가입된 이메일입니다." };
    }
    await db.insert(users)
      .values({
        id,
        email,
        name,
        passwordHash: hashPassword(password),
        termsAgreedAt: Date.now(),
        createdAt: Date.now(),
      });
    await createSession(id);
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
  redirect(safeNext(formData.get("next")));
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    agree: formData.get("agree"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, password } = parsed.data;
  const WRONG = "이메일 또는 비밀번호가 올바르지 않습니다.";

  try {
    const ip = await clientIp();
    const emailKey = `login:${email}`;
    const ipKey = ip ? `login-ip:${ip}` : null;
    // 막혔으면 비밀번호를 확인하지도 않는다 (맞는 비밀번호로 풀리면 대입을 막을 수 없다)
    const [emailBlocked, ipBlocked] = await Promise.all([
      isBlocked(emailKey, LIMITS.loginEmail),
      ipKey ? isBlocked(ipKey, LIMITS.loginIp) : Promise.resolve(false),
    ]);
    if (emailBlocked || ipBlocked) return { error: BLOCKED_MESSAGE.login };

    const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    // 없는 계정이어도 같은 시간이 걸리게 한다 (응답 시간으로 가입 여부를 알아낼 수 없게)
    const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH) && Boolean(user?.passwordHash);
    if (!user || !ok) {
      await Promise.all([consume(emailKey, LIMITS.loginEmail), ipKey ? consume(ipKey, LIMITS.loginIp) : null]);
      // 구글로만 가입한 계정은 비밀번호가 없다
      if (user?.googleId && !user.passwordHash) {
        return { error: "구글로 가입한 계정입니다. 아래 '구글로 계속하기'를 눌러주세요." };
      }
      return { error: WRONG };
    }
    await reset(emailKey);
    await createSession(user.id);
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
