/**
 * 브라우저 푸시 E2E (가짜 푸시 서비스 사용).
 * 브라우저 구독은 실제 FCM 서버가 필요하므로, 구독 정보를 직접 만들어 넣고
 * 서버가 보내는 요청(VAPID 서명·암호화 본문)이 규격에 맞는지 확인한다.
 *
 * 준비: 가짜 푸시 서비스(8796) + 앱(VAPID_*, CRON_KEY 설정) 기동
 * 실행: node tests/e2e-push.mjs
 */
import { launchBrowser } from "./browser.mjs";
import postgres from "../node_modules/postgres/src/index.js";
import fs from "node:fs";
import { webcrypto as wc } from "node:crypto";

const BASE = process.env.BASE ?? "http://localhost:3000";
const PUSH = process.env.PUSH_SERVICE ?? "http://127.0.0.1:8796";
const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/zunall";
const CRON_KEY = process.env.CRON_KEY ?? "test-cron-key";

const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const dday = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const sql = postgres(DB, { prepare: false });
const browser = await launchBrowser();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

try {
  fs.rmSync("/tmp/push-received.json", { force: true });

  // 1) 사용자 + 마감 임박 활동
  const email = `push-${Date.now()}@test.local`;
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("이름").fill("푸시");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("pushpass123!");
  await page.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL(`${BASE}/`);

  await page.goto(`${BASE}/activities/new`);
  await page.getByLabel("활동명 *").fill("푸시 테스트 공모전");
  await page.getByLabel("상태").selectOption("planned");
  await page.getByLabel("접수(지원) 마감일").fill(dday(1));
  await page.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await page.waitForURL(/\/activities\/[a-z0-9]{20}$/);

  await page.goto(`${BASE}/settings`);
  const settings = await page.locator("main").innerText();
  step("설정에 브라우저 알림 카드 노출", settings.includes("알림 받기") || settings.includes("VAPID"));

  // 2) 브라우저 구독을 흉내내 DB에 직접 등록
  const keys = await wc.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const p256dh = b64url(new Uint8Array(await wc.subtle.exportKey("raw", keys.publicKey)));
  const auth = b64url(wc.getRandomValues(new Uint8Array(16)));
  const [{ id: userId }] = await sql`SELECT id FROM users WHERE email = ${email}`;
  await sql`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, failure_count)
    VALUES (${"pushsub" + Date.now()}, ${userId}, ${`${PUSH}/push/device-1`}, ${p256dh}, ${auth}, ${Date.now()}, 0)
  `;
  step("구독 정보 저장", true);

  // 3) 크론 실행
  const cron = await page.evaluate(
    async ([base, key]) => {
      const res = await fetch(`${base}/api/cron/daily?key=${key}`);
      return { status: res.status, body: await res.json() };
    },
    [BASE, CRON_KEY],
  );
  step("크론 엔드포인트 응답", cron.status === 200 && cron.body.ok, JSON.stringify(cron.body));
  step("푸시 1건 전송 집계", cron.body.pushed === 1, `pushed=${cron.body.pushed}`);

  // 4) 잘못된 키 차단
  const unauth = await page.evaluate(async (base) => (await fetch(`${base}/api/cron/daily?key=wrong`)).status, BASE);
  step("잘못된 크론 키 차단", unauth === 401, `HTTP ${unauth}`);

  // 5) 실제로 도착한 요청 검사
  const received = JSON.parse(fs.readFileSync("/tmp/push-received.json", "utf-8"));
  const last = received[received.length - 1];
  step("푸시 서비스가 요청 수신", received.length >= 1, `${received.length}건`);
  step("VAPID Authorization 헤더", /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/.test(last.headers.authorization ?? ""));
  step("aes128gcm 인코딩 헤더", last.headers["content-encoding"] === "aes128gcm");
  step("TTL 헤더", last.headers.ttl === "86400");

  // 6) 본문 복호화 → 내용 확인
  const body = new Uint8Array(Buffer.from(last.bodyB64, "base64"));
  const salt = body.subarray(0, 16);
  const serverPublic = body.subarray(21, 86);
  const ciphertext = body.subarray(86);
  const shared = new Uint8Array(await wc.subtle.deriveBits(
    { name: "ECDH", public: await wc.subtle.importKey("raw", serverPublic.slice().buffer, { name: "ECDH", namedCurve: "P-256" }, true, []) },
    keys.privateKey, 256));
  const enc = new TextEncoder();
  const cat = (...ps) => { const o = new Uint8Array(ps.reduce((n, p) => n + p.length, 0)); let i = 0; for (const p of ps) { o.set(p, i); i += p.length; } return o; };
  const hk = async (s, ikm, info, len) => new Uint8Array(await wc.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: s.slice().buffer, info: info.slice().buffer },
    await wc.subtle.importKey("raw", ikm.slice().buffer, "HKDF", false, ["deriveBits"]), len * 8));
  const clientPublic = new Uint8Array(await wc.subtle.exportKey("raw", keys.publicKey));
  const ikm = await hk(new Uint8Array(Buffer.from(auth.replace(/-/g, "+").replace(/_/g, "/"), "base64")), shared,
    cat(enc.encode("WebPush: info\0"), clientPublic, serverPublic), 32);
  const cek = await hk(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hk(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const plain = new Uint8Array(await wc.subtle.decrypt({ name: "AES-GCM", iv: nonce.slice().buffer },
    await wc.subtle.importKey("raw", cek.slice().buffer, { name: "AES-GCM" }, false, ["decrypt"]), ciphertext.slice().buffer));
  const payload = JSON.parse(new TextDecoder().decode(plain.subarray(0, plain.length - 1)));
  step("브라우저가 본문을 복호화 가능", true, payload.title);
  step("마감 내용이 알림에 담김", payload.body.includes("푸시 테스트 공모전") && payload.body.includes("D-1"), payload.body.replace(/\n/g, " / "));

  // 7) 만료된 구독(410)은 자동 정리
  await sql`UPDATE push_subscriptions SET endpoint = ${`${PUSH}/gone`} WHERE user_id = ${userId}`;
  const cron2 = await page.evaluate(
    async ([base, key]) => (await fetch(`${base}/api/cron/daily?key=${key}`)).json(),
    [BASE, CRON_KEY],
  );
  const left = await sql`SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = ${userId}`;
  step("만료(410) 구독 자동 삭제", cron2.removed === 1 && left[0].n === 0, `removed=${cron2.removed}`);
} catch (error) {
  step(`예외: ${String(error).split("\n")[0].slice(0, 140)}`, false);
} finally {
  await browser.close();
  await sql.end();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
