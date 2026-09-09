import "server-only";

/**
 * 운영자 판별.
 * ADMIN_EMAILS 에 적힌 이메일만 지표 화면을 볼 수 있고,
 * 설정하지 않으면 아무도 볼 수 없다(화면 자체가 없는 것처럼 동작).
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string): boolean {
  const list = adminEmails();
  return list.length > 0 && list.includes(email.toLowerCase());
}
