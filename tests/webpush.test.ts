/**
 * 웹 푸시 암호화(RFC 8291) 왕복 테스트.
 * 브라우저가 하는 복호화를 그대로 재현해, 우리가 만든 본문을 다시 읽을 수 있는지 확인한다.
 * 실행: npx tsx tests/webpush.test.ts
 */
import { b64urlToBytes, bytesToB64url, encryptPayload } from "../src/services/push/crypto";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

async function main() {
  check("base64url 왕복", bytesToB64url(b64urlToBytes("SGVsbG8td29ybGRfMTIz")) === "SGVsbG8td29ybGRfMTIz");
  check("패딩 없는 문자열 처리", b64urlToBytes("AQAB").length === 3);

  // 브라우저 구독 키쌍을 흉내낸다
  const clientKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const clientPublic = new Uint8Array(await crypto.subtle.exportKey("raw", clientKeys.publicKey));
  const authSecret = crypto.getRandomValues(new Uint8Array(16));

  const message = JSON.stringify({ title: "D-1 마감", body: "지원 마감까지 하루 남았습니다.", url: "/" });
  const encrypted = await encryptPayload(
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/fake",
      p256dh: bytesToB64url(clientPublic),
      auth: bytesToB64url(authSecret),
    },
    message,
  );

  check("aes128gcm 헤더 길이 (salt16+size4+idlen1+key65)", encrypted.length > 86, `${encrypted.length} bytes`);
  const recordSize = new DataView(encrypted.buffer, encrypted.byteOffset + 16, 4).getUint32(0, false);
  check("레코드 크기 필드", recordSize === 4096, String(recordSize));
  check("키 길이 필드 = 65", encrypted[20] === 65, String(encrypted[20]));

  // ── 브라우저 쪽 복호화 재현 ──────────────────────────────────
  const salt = encrypted.subarray(0, 16);
  const serverPublic = encrypted.subarray(21, 86);
  const ciphertext = encrypted.subarray(86);

  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: await crypto.subtle.importKey(
          "raw",
          serverPublic.slice().buffer as ArrayBuffer,
          { name: "ECDH", namedCurve: "P-256" },
          true,
          [],
        ),
      },
      clientKeys.privateKey,
      256,
    ),
  );

  const enc = new TextEncoder();
  const cat = (...parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };
  const hk = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) => {
    const k = await crypto.subtle.importKey("raw", ikm.slice().buffer as ArrayBuffer, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: s.slice().buffer as ArrayBuffer, info: info.slice().buffer as ArrayBuffer },
        k,
        len * 8,
      ),
    );
  };

  const ikm = await hk(authSecret, shared, cat(enc.encode("WebPush: info\0"), clientPublic, serverPublic), 32);
  const cek = await hk(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hk(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  let decrypted = "";
  try {
    const key = await crypto.subtle.importKey("raw", cek.slice().buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce.slice().buffer as ArrayBuffer },
        key,
        ciphertext.slice().buffer as ArrayBuffer,
      ),
    );
    // 마지막 바이트는 레코드 끝 표시(0x02)
    check("레코드 구분자(0x02) 부착", plain[plain.length - 1] === 0x02);
    decrypted = new TextDecoder().decode(plain.subarray(0, plain.length - 1));
  } catch (error) {
    check(`복호화 실패: ${String(error).slice(0, 80)}`, false);
  }

  check("복호화 결과가 원본과 동일", decrypted === message, decrypted.slice(0, 40));
  check("한글 본문 보존", decrypted.includes("지원 마감까지 하루 남았습니다."));



}

main().then(() => {
  console.log(failed === 0 ? "\n모든 테스트 통과" : `\n${failed}개 실패`);
  process.exit(failed === 0 ? 0 : 1);
});
