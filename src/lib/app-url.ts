import "server-only";
import { headers } from "next/headers";

/**
 * 지금 서비스가 열려 있는 주소.
 * 메일에 넣을 링크처럼 "밖에서 다시 들어와야 하는" 주소를 만들 때 쓴다.
 */
export async function appOrigin(): Promise<string> {
  const explicit = process.env.APP_ORIGIN;
  if (explicit) return explicit.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
