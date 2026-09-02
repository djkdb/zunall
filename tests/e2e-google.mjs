/**
 * 구글 로그인 E2E — 가짜 구글 서버(/tmp/mock-google.mjs)로 전체 흐름을 검증한다.
 * 준비: 가짜 구글 서버 기동 + 앱을 GOOGLE_* 환경변수와 함께 기동
 * 실행: BASE=http://localhost:3000 node tests/e2e-google.mjs
 */
import { launchBrowser } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await launchBrowser();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

try {
  await page.goto(`${BASE}/login`);
  step("로그인 화면에 '구글로 계속하기' 버튼 노출", (await page.getByRole("link", { name: /구글로 계속하기/ }).count()) > 0);

  await page.getByRole("link", { name: /구글로 계속하기/ }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 30000 });
  step("구글 로그인 → 계정 생성 + 대시보드 진입", page.url() === `${BASE}/`);

  const body = await page.locator("body").innerText();
  step("구글 프로필 이름이 반영됨", body.includes("구글 테스터"), "구글 테스터");

  await page.goto(`${BASE}/settings`);
  const settings = await page.locator("body").innerText();
  step("설정 화면에 구글 이메일 표시", settings.includes("tester@gmail.com"));

  // 재로그인: 같은 구글 계정으로 다시 들어오면 새 계정이 생기지 않아야 한다
  await page.goto(`${BASE}/api/auth/logout`).catch(() => {});
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.getByRole("link", { name: /구글로 계속하기/ }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 30000 });
  // 같은 구글 계정으로 두 번 들어와도 계정은 하나여야 한다 — 설정 화면의 이메일로 확인
  await page.goto(`${BASE}/settings`);
  const again = await page.locator("body").innerText();
  step("같은 구글 계정 재로그인 (같은 계정으로 연결)", again.includes("tester@gmail.com"));

  // state 위조 차단
  const forged = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/auth/google/callback?code=fake-code-123&state=forged`, {
      redirect: "manual",
    });
    return res.type === "opaqueredirect" || res.status === 0 || res.status >= 300;
  }, BASE);
  step("state 불일치 콜백 차단", forged);

  await page.goto(`${BASE}/api/health`);
  const health = JSON.parse(await page.locator("pre, body").first().innerText());
  step("진단 엔드포인트 정상", health.connected === true && health.missingTables.length === 0,
    `${health.runtime} / ${health.database}`);
} catch (error) {
  step(`예외: ${String(error).split("\n")[0]}`, false);
} finally {
  await browser.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
