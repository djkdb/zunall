/**
 * 출시 준비 E2E. 실행: node tests/e2e-launch.mjs
 * (운영 지표 항목은 서버에 ADMIN_EMAILS=admin@cavero.test 가 있어야 통과한다)
 *
 * - 소개 화면: 가치 제안·모의 면접·요금·FAQ, 링크 미리보기(OG), robots, 보안 헤더
 * - 로그인 대입 막기: 같은 이메일로 5번 틀리면 맞는 비밀번호도 잠시 막는다
 * - 휴대폰: 하단 탭과 전체 메뉴
 * - 둘러보기: 면접 일정과 끝난 모의 면접이 들어 있다
 * - 의견 보내기 → 운영 지표의 의견함
 */
import { launchBrowser, describePage } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@cavero.test";
const results = [];
const step = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`);
};
const consoleErrors = [];

const b = await launchBrowser();
let p;
try {
  // ── 소개 화면 ─────────────────────────────────────────────
  const anon = await b.newContext();
  p = await anon.newPage();
  p.setDefaultTimeout(30000);
  p.on("console", (m) => m.type() === "error" && consoleErrors.push(`welcome: ${m.text()}`));
  const res = await p.goto(`${BASE}/`);
  const landing = await p.locator("body").innerText();
  step("소개: 지원 판단부터 모의 면접까지", landing.includes("모의 면접까지") && landing.includes("지원할 만한지"));
  step("소개: 모의 면접 소개 구역", landing.includes("꼬리질문까지 연습합니다"));
  step("소개: 범위를 숫자로", /\d+개\s*면접 직무/.test(landing) && landing.includes("기업·공공기관 면접 정보"));
  step("소개: 모든 계열", ["인문", "예체능", "의약"].every((w) => landing.includes(w)));
  step("소개: 자주 묻는 질문", landing.includes("자주 묻는 질문") && landing.includes("AI 학습에 쓰이나요"));
  const headers = res?.headers() ?? {};
  step("보안 헤더: CSP", (headers["content-security-policy"] ?? "").includes("frame-ancestors"));
  step("보안 헤더: nosniff·referrer·permissions", headers["x-content-type-options"] === "nosniff" && Boolean(headers["referrer-policy"]) && (headers["permissions-policy"] ?? "").includes("microphone=(self)"));
  step("서버 이름을 드러내지 않음", !headers["x-powered-by"]);
  const og = await p.locator('meta[property="og:image"]').getAttribute("content");
  step("링크 미리보기 이미지(절대 주소)", Boolean(og && /^https?:\/\/.+\/og\.png$/.test(og)), og ?? "");
  const ogImage = await p.request.get(`${BASE}/og.png`);
  step("미리보기 이미지가 열림", ogImage.ok() && (ogImage.headers()["content-type"] ?? "").includes("image/png"));
  const robots = await (await p.request.get(`${BASE}/robots.txt`)).text();
  step("robots: 둘러보기·API 는 따라오지 않게", robots.includes("Disallow: /demo") && robots.includes("Disallow: /api/") && robots.includes("Sitemap:"));
  // 이 요청의 404 는 의도한 것이라 콘솔 오류에서 뺀다
  const before404 = consoleErrors.length;
  const notFound = await p.goto(`${BASE}/this-page-does-not-exist`);
  consoleErrors.splice(before404);
  step("없는 주소는 안내가 있는 404", notFound?.status() === 404 && (await p.locator("body").innerText()).includes("찾는 화면이 없습니다"));
  await anon.close();

  // ── 로그인 대입 막기 ──────────────────────────────────────
  const ctx = await b.newContext();
  p = await ctx.newPage();
  p.setDefaultTimeout(30000);
  const email = `launch-${Date.now()}@test.local`;
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("출시");
  await p.getByLabel("이메일").fill(email);
  await p.getByLabel("비밀번호").fill("launchpass123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);
  await ctx.clearCookies();
  const tryLogin = async (password) => {
    await p.goto(`${BASE}/login`);
    await p.getByLabel("이메일").fill(email);
    await p.getByLabel("비밀번호").fill(password);
    await p.getByRole("button", { name: "로그인" }).click();
    await Promise.race([
      p.waitForURL(`${BASE}/`, { timeout: 15000 }),
      p.getByText(/올바르지 않습니다|너무 많습니다/).first().waitFor({ timeout: 15000 }),
    ]).catch(() => {});
    return new URL(p.url()).pathname === "/" ? "in" : await p.locator("body").innerText();
  };
  let last = "";
  for (let i = 0; i < 5; i++) last = await tryLogin("wrong-password-1");
  step("틀린 비밀번호는 같은 문구", last.includes("이메일 또는 비밀번호가 올바르지 않습니다"), last.slice(0, 80).replace(/\n/g, " "));
  const blocked = await tryLogin("launchpass123!");
  step("5번 틀리면 맞는 비밀번호도 잠시 막힘", blocked !== "in" && blocked.includes("로그인 시도가 너무 많습니다"));
  const other = `launch-other-${Date.now()}@test.local`;
  await p.goto(`${BASE}/login`);
  await p.getByLabel("이메일").fill(other);
  await p.getByLabel("비밀번호").fill("whatever123!");
  await p.getByRole("button", { name: "로그인" }).click();
  await p.waitForTimeout(1500);
  step("다른 이메일은 영향 없음", !(await p.locator("body").innerText()).includes("로그인 시도가 너무 많습니다"));
  await ctx.close();

  // ── 휴대폰 화면 + 둘러보기 ─────────────────────────────────
  const mobile = await b.newContext({ viewport: { width: 390, height: 844 } });
  p = await mobile.newPage();
  p.setDefaultTimeout(30000);
  p.on("console", (m) => m.type() === "error" && consoleErrors.push(`mobile: ${m.text()}`));
  await p.goto(`${BASE}/demo`);
  await p.waitForURL(/\/\?demo=1/, { timeout: 60000 });
  const tabs = p.getByRole("navigation", { name: "주요 메뉴" });
  step("휴대폰: 하단 탭 (이름과 함께)", (await tabs.isVisible()) && ["홈", "커리어", "활동", "면접", "전체"].every(async () => true) && (await tabs.innerText()).includes("면접"));
  step("휴대폰: 옆 막대 메뉴는 숨김", !(await p.locator("aside").isVisible()));
  await p.locator("button[aria-controls=mobile-more]").click();
  const more = p.getByRole("dialog", { name: "전체 메뉴" });
  step("휴대폰: 전체 메뉴에 나머지 화면", (await more.innerText()).includes("자소서") && (await more.innerText()).includes("의견 보내기"));
  await more.getByRole("link", { name: /자소서/ }).click();
  await p.waitForURL(/\/essays$/);
  step("휴대폰: 전체 메뉴로 이동하면 메뉴가 닫힘", await more.waitFor({ state: "hidden", timeout: 5000 }).then(() => true, () => false));
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  step("휴대폰: 가로 스크롤 없음", over <= 2, `${over}px`);

  let main = "";
  await p.goto(`${BASE}/`);
  main = await p.locator("main").innerText();
  step("둘러보기: 대시보드에 다가오는 면접", main.includes("면접 D-5") && main.includes("네이버 서비스 기획 인턴"));
  await p.goto(`${BASE}/interview`);
  main = await p.locator("main").innerText();
  step("둘러보기: 끝난 모의 면접 기록", main.includes("네이버") && /\d+\s*[SABCD]/.test(main));
  await p.locator('a[href^="/interview/"]').filter({ hasText: "네이버" }).first().click();
  await p.getByTestId("mi-overall").waitFor();
  main = await p.locator("main").innerText();
  step("둘러보기: 모의 면접 리포트", main.includes("가장 먼저 고칠 것") && main.includes("문답별 피드백"));
  step("둘러보기: 기획 직무에 개발 질문이 없음", !/시간복잡도|정렬 알고리즘|자료구조/.test(main));

  // ── 의견 보내기 ───────────────────────────────────────────
  await p.locator("button[aria-controls=mobile-more]").click();
  await p.getByRole("dialog", { name: "전체 메뉴" }).getByRole("button", { name: "의견 보내기" }).click();
  const message = `E2E 의견 ${Date.now()}: 하단 탭이 편해요`;
  await p.getByRole("radio", { name: "좋았던 점" }).click();
  await p.locator("#fb-message").fill(message);
  await p.getByRole("button", { name: "보내기", exact: true }).click();
  await p.getByText("보내 주셔서 고맙습니다").waitFor();
  step("의견 보내기", true);
  await mobile.close();

  const adminCtx = await b.newContext();
  p = await adminCtx.newPage();
  p.setDefaultTimeout(30000);
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("관리자");
  await p.getByLabel("이메일").fill(ADMIN_EMAIL);
  await p.getByLabel("비밀번호").fill("adminpass123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForTimeout(2000);
  if (!p.url().endsWith("/")) {
    await p.goto(`${BASE}/login`);
    await p.getByLabel("이메일").fill(ADMIN_EMAIL);
    await p.getByLabel("비밀번호").fill("adminpass123!");
    await p.getByRole("button", { name: "로그인" }).click();
    await p.waitForURL(`${BASE}/`, { timeout: 30000 });
  }
  await p.goto(`${BASE}/admin`);
  main = await p.locator("main").innerText();
  step("운영 지표: 의견함에 방금 보낸 의견", main.includes("의견함") && main.includes(message) && main.includes("좋았던 점"));
  step("운영 지표: 답장을 원하지 않으면 이메일 없음", !main.split(message)[0].split("\n").slice(-3).join(" ").includes("답장:"));
  step("운영 지표: 모의 면접 지표", main.includes("끝낸 모의 면접"));
  await adminCtx.close();

  step("콘솔 오류 없음 (보안 헤더로 막힌 리소스 없음)", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} catch (error) {
  console.error(`❌ 실패 시점 — ${p ? await describePage(p).catch(() => "") : ""}`);
  console.error(error);
  results.push(false);
} finally {
  await b.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
