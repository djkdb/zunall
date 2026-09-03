/**
 * Cloudflare Workers 런타임 스모크 테스트.
 * 준비: npm run build:cf && (Postgres 준비 + schema.sql 적용)
 *       && npx wrangler dev --port 8799 --var DATABASE_URL:... --var SUPABASE_URL:...
 * 실행: node tests/e2e-workerd.mjs
 */
import { launchBrowser } from "./browser.mjs";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:8787";
const results = [];
const step = (n, ok, d="") => { results.push(ok); console.log(`${ok?"✅":"❌"} ${n}${d?` — ${d}`:""}`); };

fs.writeFileSync("/tmp/wk-notice.txt", "AI 개발 인턴 모집\n■ 자격 요건\n- React, TypeScript, AI 서비스 개발 경험\n■ 제출물\n- 이력서\n- 포트폴리오\n");

const browser = await launchBrowser();
const page = await browser.newPage();
page.setDefaultTimeout(30000);
try {
  const email = `wk-${Date.now()}@test.local`;
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("이름").fill("워커드");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("worker123!");
  await page.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 30000 });
  step("workerd: 회원가입(Postgres 쓰기+scrypt+세션) → 대시보드", true);

  await page.goto(`${BASE}/career`);
  await page.getByLabel("어떤 목표를 향해 가고 있나요? *").fill("AI Software Engineer");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("나를 한 줄로 표현하면?").fill("Workers Test");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "AI 활용", exact: true }).click();
  await page.getByRole("button", { name: "Career Profile 만들기" }).click();
  await page.waitForSelector("text=Career Readiness", { timeout: 30000 });
  step("workerd: 온보딩 → Career Score 계산", true);

  await page.goto(`${BASE}/activities/new`);
  await page.getByLabel("활동명 *").fill("워커드 테스트 공고");
  await page.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await page.waitForURL(/\/activities\/[a-z0-9]{20}$/, { timeout: 30000 });
  const url = page.url();
  step("workerd: 활동 생성", true);

  await page.goto(`${url}?tab=documents`);
  await page.getByRole("button", { name: "파일 업로드" }).first().click();
  await page.getByLabel("파일 *").setInputFiles("/tmp/wk-notice.txt");
  await page.getByLabel("분류").selectOption("notice");
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  await page.waitForSelector("text=wk-notice.txt", { timeout: 30000 });
  step("workerd: 파일 업로드(DB 저장) + 텍스트 추출", (await page.locator("text=텍스트 추출됨").count()) > 0);

  const dl = await page.evaluate(async () => {
    const link = document.querySelector("a[href^='/api/files/']");
    if (!link) return null;
    const res = await fetch(link.getAttribute("href"));
    return { ok: res.ok, len: (await res.arrayBuffer()).byteLength };
  });
  const expectedBytes = fs.statSync("/tmp/wk-notice.txt").size;
  step(
    "workerd: 파일 다운로드 (바이트 일치)",
    !!dl?.ok && dl.len === expectedBytes,
    `${dl?.len} / ${expectedBytes} bytes`,
  );

  await page.goto(`${url}?tab=fit`);
  await page.getByRole("button", { name: "지원 적합도 분석" }).click();
  await page.waitForSelector("text=판단 근거", { timeout: 60000 });
  step("workerd: AI 추출 + 적합도 분석 파이프라인", true);
} catch (e) {
  step("workerd smoke", false, e.message?.slice(0, 200));
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} 통과`);
process.exit(results.every(Boolean) ? 0 : 1);
