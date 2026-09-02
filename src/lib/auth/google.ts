import "server-only";
import { randomBytes } from "node:crypto";

/**
 * 구글 OAuth 2.0 (Authorization Code) — 외부 라이브러리 없이 fetch 로만 처리한다.
 * Workers 번들 크기를 늘리지 않기 위한 선택이며, 표준 흐름을 그대로 따른다.
 *
 * 필요한 환경변수(둘 다 있어야 기능이 켜진다):
 *   GOOGLE_CLIENT_ID     — Google Cloud Console 의 OAuth 클라이언트 ID
 *   GOOGLE_CLIENT_SECRET — 같은 클라이언트의 시크릿
 * 선택:
 *   GOOGLE_REDIRECT_URI  — 리다이렉트 URI 를 직접 지정 (미지정 시 요청 주소에서 유추)
 */

// 엔드포인트는 로컬 테스트에서 가짜 구글 서버로 바꿀 수 있게 환경변수로 덮어쓸 수 있다.
// 운영에서는 설정하지 않는다.
const authEndpoint = () => process.env.GOOGLE_AUTH_ENDPOINT || "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = () => process.env.GOOGLE_TOKEN_ENDPOINT || "https://oauth2.googleapis.com/token";

export const STATE_COOKIE = "cavero_oauth_state";

export function googleAuthEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function newOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/** 요청 주소에서 콜백 URI 를 만든다. 프록시 뒤에서도 https 를 유지한다. */
export function callbackUrl(requestUrl: string, headers: Headers): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI;
  if (explicit) return explicit;

  const url = new URL(requestUrl);
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? url.host;
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/auth/google/callback`;
}

export function authorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${authEndpoint()}?${params.toString()}`;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

/**
 * 인가 코드를 프로필로 교환한다.
 * id_token 은 구글의 토큰 엔드포인트에서 TLS 로 직접 받아오므로(서버 대 서버)
 * 서명 검증 없이 payload 를 신뢰할 수 있다 — 구글 문서가 명시하는 예외다.
 * 그래도 aud/iss 는 확인해 다른 클라이언트의 토큰이 섞이지 않도록 한다.
 */
export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleProfile> {
  const response = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`구글 토큰 교환 실패 (${response.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("구글 응답에 id_token 이 없습니다.");

  const payload = decodeJwtPayload(data.id_token);
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error("구글 토큰의 대상(client_id)이 일치하지 않습니다.");
  }
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    throw new Error("구글 토큰의 발급자가 올바르지 않습니다.");
  }
  if (!payload.sub || !payload.email) {
    throw new Error("구글 계정 정보를 읽지 못했습니다.");
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: payload.name?.trim() || payload.email.split("@")[0],
    picture: payload.picture ?? null,
  };
}

interface IdTokenPayload {
  sub?: string;
  aud?: string;
  iss?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

function decodeJwtPayload(token: string): IdTokenPayload {
  const part = token.split(".")[1];
  if (!part) throw new Error("id_token 형식이 올바르지 않습니다.");
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(base64, "base64").toString("utf-8");
  return JSON.parse(json) as IdTokenPayload;
}
