import "server-only";
import { encryptPayload, type PushSubscriptionData } from "./crypto";
import { b64urlToBytes, bytesToB64url } from "./crypto";

/**
 * 웹 푸시 전송 (RFC 8292 VAPID).
 * 라이브러리 없이 Web Crypto 로 서명하므로 Workers 번들이 커지지 않는다.
 */

export type { PushSubscriptionData };

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

/** VAPID 개인키(32바이트 d) + 공개키(65바이트)를 서명용 CryptoKey 로 */
async function importVapidKey(privateKey: string, publicKey: string): Promise<CryptoKey> {
  const d = b64urlToBytes(privateKey);
  const pub = b64urlToBytes(publicKey);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: bytesToB64url(d),
    x: bytesToB64url(pub.subarray(1, 33)),
    y: bytesToB64url(pub.subarray(33, 65)),
    ext: true,
    key_ops: ["sign"],
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function vapidAuthorization(audience: string): Promise<string> {
  const publicKey = process.env.VAPID_PUBLIC_KEY!;
  const privateKey = process.env.VAPID_PRIVATE_KEY!;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@cavero.app";

  const encoder = new TextEncoder();
  const header = bytesToB64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    encoder.encode(
      JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }),
    ),
  );
  const signingInput = `${header}.${payload}`;

  const key = await importVapidKey(privateKey, publicKey);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      buf(encoder.encode(signingInput)),
    ),
  );
  return `vapid t=${signingInput}.${bytesToB64url(signature)}, k=${publicKey}`;
}

export interface PushResult {
  ok: boolean;
  status: number;
  /** 구독이 사라져 지워야 하는 경우 */
  gone: boolean;
}

/** 한 기기에 푸시를 보낸다 */
export async function sendPush(
  subscription: PushSubscriptionData,
  payload: PushPayload,
): Promise<PushResult> {
  if (!pushConfigured()) return { ok: false, status: 0, gone: false };

  const endpoint = new URL(subscription.endpoint);
  const body = await encryptPayload(subscription, JSON.stringify(payload));
  const authorization = await vapidAuthorization(endpoint.origin);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      authorization,
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: "86400",
      urgency: "normal",
    },
    body: buf(body),
  });

  return {
    ok: response.ok,
    status: response.status,
    // 404/410 = 구독 만료 (브라우저가 구독을 폐기함)
    gone: response.status === 404 || response.status === 410,
  };
}
