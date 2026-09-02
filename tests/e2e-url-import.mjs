/**
 * 공고 URL 가져오기 E2E.
 * 준비: 가짜 공고 사이트(8795) + 앱을 ALLOW_PRIVATE_FETCH=1 로 기동
 * 실행: node tests/e2e-url-import.mjs
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SITE = process.env.SITE ?? "http://127.0.0.1:8795";
const results = [];
const step = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
page.setDefaultTimeout(30000);

try {
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("이름").fill("링크수집");
  await page.getByLabel("이메일").fill(`url-${Date.now()}@test.local`);
  await page.getByLabel("비밀번호").fill("urlpass123!");
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL(`${BASE}/`);

  await page.goto(`${BASE}/activities/new`);
  await page.getByLabel("활동명 *").fill("링크로 등록한 공모전");
  await page.getByRole("button", { name: "활동 만들기" }).click();
  await page.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  const activityUrl = page.url();

  // 1) 정상 공고 페이지 가져오기
  await page.goto(`${activityUrl}?tab=documents`);
  await page.getByRole("button", { name: "링크로 가져오기" }).first().click();
  await page.getByLabel("공고 주소 *").fill(`${SITE}/notice`);
  await page.getByRole("button", { name: "가져오기", exact: true }).click();
  await page.waitForSelector("text=텍스트 추출됨", { timeout: 30000 });
  let text = await page.locator("main").innerText();
  step("링크 가져오기 → 문서 생성 + 텍스트 추출", text.includes("캐버로 AI 아이디어 공모전"));
  step("가져온 출처(URL)를 문서 설명에 기록", text.includes("링크에서 가져옴"));

  // 2) 가져온 본문으로 공고 분석 (마감일·기준 추출)
  await page.goto(`${activityUrl}?tab=ai`);
  await page.getByRole("button", { name: "공고문 분석" }).click();
  await page.waitForURL(/review=/, { timeout: 90000 });
  await page.waitForSelector("text=AI Summary", { timeout: 30000 });
  text = await page.locator("main").innerText();
  step(
    "가져온 공고에서 마감일 추출",
    text.includes("2026.10.20") || text.includes("2026-10-20") || text.includes("10월 20일"),
    (text.match(/2026-\d{2}-\d{2}/g) ?? []).slice(0, 3).join(", "),
  );
  step("심사 기준 추출", /창의성|실현 가능성/.test(text));

  // 3) 오류 처리 — 웹페이지가 아닌 주소
  await page.goto(`${activityUrl}?tab=documents`);
  await page.getByRole("button", { name: "링크로 가져오기" }).first().click();
  await page.getByLabel("공고 주소 *").fill(`${SITE}/pdf`);
  await page.getByRole("button", { name: "가져오기", exact: true }).click();
  await page.waitForTimeout(2500);
  text = await page.locator("body").innerText();
  step("웹페이지가 아닌 주소 → 안내", text.includes("웹페이지가 아닙니다"));

  // 4) 본문이 비어있는 페이지
  await page.getByLabel("공고 주소 *").fill(`${SITE}/empty`);
  await page.getByRole("button", { name: "가져오기", exact: true }).click();
  await page.waitForTimeout(2500);
  text = await page.locator("body").innerText();
  step("본문 없는 페이지 → 대안 안내", text.includes("본문을 거의 읽지 못했습니다"));

  // 5) 존재하지 않는 페이지
  await page.getByLabel("공고 주소 *").fill(`${SITE}/404`);
  await page.getByRole("button", { name: "가져오기", exact: true }).click();
  await page.waitForTimeout(2500);
  text = await page.locator("body").innerText();
  step("404 페이지 → HTTP 상태 안내", text.includes("HTTP 404"));
} catch (error) {
  step(`예외: ${String(error).split("\n")[0].slice(0, 120)}`, false);
} finally {
  await browser.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
