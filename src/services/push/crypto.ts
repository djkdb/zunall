/**
 * 웹 푸시 본문 암호화 (RFC 8291, aes128gcm).
 * Web Crypto 만 사용하므로 런타임을 가리지 않고, 테스트도 가능하다.
 */

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string; // base64url
  auth: string; // base64url
}

/* ── base64url 유틸 ─────────────────────────────────────────── */

export function b64urlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** 뷰가 아닌 독립 ArrayBuffer 로 복사 (Web Crypto 타입 호환) */
function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

/* ── 키 변환 ────────────────────────────────────────────────── */

/** 비압축 P-256 공개키(65바이트)를 CryptoKey 로 */
async function importPublicKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", buf(raw), { name: "ECDH", namedCurve: "P-256" }, true, []);
}

/* ── HKDF ───────────────────────────────────────────────────── */

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}


/* ── 본문 암호화 ────────────────────────────────────────────── */

export async function encryptPayload(
  subscription: PushSubscriptionData,
  plaintext: string,
): Promise<Uint8Array> {

  const clientPublic = b64urlToBytes(subscription.p256dh);
  const authSecret = b64urlToBytes(subscription.auth);

  const localKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const localPublic = new Uint8Array(await crypto.subtle.exportKey("raw", localKeys.publicKey));

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: await importPublicKey(clientPublic) },
    localKeys.privateKey,
    256,
  );
  const shared = new Uint8Array(sharedBits);

  const encoder = new TextEncoder();
  // PRK = HKDF(auth_secret, ecdh_secret, "WebPush: info" || ua_public || as_public)
  const keyInfo = concat(
    encoder.encode("WebPush: info\0"),
    clientPublic,
    localPublic,
  );
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", buf(cek), { name: "AES-GCM" }, false, ["encrypt"]);
  // 레코드 끝 표시(0x02) 를 붙인 뒤 암호화한다
  const body = concat(encoder.encode(plaintext), new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(nonce) }, aesKey, buf(body)),
  );

  // 헤더: salt(16) | record size(4, BE) | key id length(1) | key id(65)
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  return concat(salt, recordSize, new Uint8Array([localPublic.length]), localPublic, ciphertext);
}
