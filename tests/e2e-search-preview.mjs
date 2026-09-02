/** 전체 검색 + 첨부 미리보기 E2E. 실행: node tests/e2e-search-preview.mjs */
import { launchBrowser } from "./browser.mjs";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

fs.writeFileSync("/tmp/search-notice.txt", "2026 캐버로 공모전 안내\n주최: 캐버로랩\n심사 기준: 창의성과 실현 가능성\n제출물: 기획서\n특이 키워드: 라이트하우스프로젝트");
const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(30000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("검색");
  await p.getByLabel("이메일").fill(`search-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("searchpass123!");
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill("검색용 공모전");
  await p.getByLabel("메모").fill("이 활동의 메모에는 특수단어 오로라캠페인 이 들어있다.");
  await p.getByRole("button", { name: "활동 만들기" }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  const url = p.url();

  await p.goto(`${url}?tab=documents`);
  await p.getByRole("button", { name: "파일 업로드" }).first().click();
  await p.getByLabel("파일 *").setInputFiles("/tmp/search-notice.txt");
  await p.getByRole("button", { name: "업로드", exact: true }).click();
  await p.waitForSelector("text=텍스트 추출됨");

  // 미리보기
  await p.getByLabel("미리보기").first().click();
  await p.waitForSelector("text=라이트하우스프로젝트", { timeout: 20000 });
  step("텍스트 첨부 미리보기 (내려받지 않고 내용 확인)", true);
  step("미리보기에서 내려받기 제공", (await p.getByRole("button", { name: /내려받기/ }).count()) > 0);
  await p.getByRole("button", { name: "닫기", exact: true }).last().click();

  // 검색: 문서 본문
  await p.goto(`${BASE}/search?q=${encodeURIComponent("라이트하우스프로젝트")}`);
  let text = await p.locator("main").innerText();
  step("문서 본문 검색", text.includes("문서 본문") && text.includes("search-notice.txt"));
  step("검색어 주변 문장 표시", text.includes("라이트하우스프로젝트"));

  // 검색: 활동 메모
  await p.goto(`${BASE}/search?q=${encodeURIComponent("오로라캠페인")}`);
  text = await p.locator("main").innerText();
  step("활동 메모 검색", text.includes("검색용 공모전"));

  // 결과 없음
  await p.goto(`${BASE}/search?q=${encodeURIComponent("존재하지않는단어zzz")}`);
  text = await p.locator("main").innerText();
  step("결과 없음 안내", text.includes("결과가 없습니다"));

  // 두 글자 미만
  await p.goto(`${BASE}/search?q=a`);
  text = await p.locator("main").innerText();
  step("최소 길이 안내", text.includes("두 글자 이상"));
} catch (e) {
  step(`예외: ${String(e).split("\n")[0].slice(0, 130)}`, false);
} finally {
  await b.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
