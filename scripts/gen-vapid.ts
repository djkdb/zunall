/**
 * 웹 푸시용 VAPID 키쌍 생성. 실행: npx tsx scripts/gen-vapid.ts
 * 출력된 두 값을 Cloudflare 시크릿(또는 .env)에 넣으면 브라우저 알림이 켜진다.
 */
import { webcrypto as crypto } from "node:crypto";

const b64url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function main() {
const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
const jwk = await crypto.subtle.exportKey("jwk", keys.privateKey);

console.log("\n웹 푸시 VAPID 키가 만들어졌습니다. 아래 두 값을 등록하세요.\n");
console.log(`VAPID_PUBLIC_KEY=${b64url(publicKey)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log(`VAPID_SUBJECT=mailto:본인이메일@example.com   (선택)\n`);
console.log("Cloudflare: npx wrangler secret put VAPID_PUBLIC_KEY  (그리고 VAPID_PRIVATE_KEY)");
console.log("또는 대시보드 → Settings → Variables and Secrets 에서 추가\n");
}

main();
