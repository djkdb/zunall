/** 링크·공고문 한 번에 등록 E2E. 실행: node tests/e2e-quick-create.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const SITE = process.env.SITE ?? "http://127.0.0.1:8795";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const pasted = `2026 그린테크 아이디어 공모전

주최: 한국환경산업기술원

■ 접수기간: 2026.09.15 ~ 2026.10.31
지원 마감: 2026년 10월 31일
제출 마감: 2026년 11월 20일
결과 발표: 2026년 12월 10일

■ 지원 자격
- 전국 대학생 및 대학원생
- 3인 이내 팀

■ 제출 서류
- 참가신청서
- 아이디어 기획서 (PDF 15p 이내)

■ 심사 기준
- 창의성 40%
- 실현 가능성 35%
- 환경적 효과 25%
`;

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(40000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("빠른등록");
  await p.getByLabel("이메일").fill(`quick-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("quickpass123!");
  await p.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  // 1) 링크로 등록
  await p.goto(`${BASE}/activities/new`);
  step("빠른 등록 카드 노출", (await p.locator("main").innerText()).includes("한 번에 등록"));
  await p.getByLabel("공고 주소").fill(`${SITE}/notice`);
  await p.getByRole("button", { name: /자동으로 활동 만들기/ }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/, { timeout: 90000 });
  let text = await p.locator("main").innerText();
  step("링크만으로 활동 생성", text.includes("캐버로 AI 아이디어 공모전"), text.split("\n")[0]);
  step("주최 자동 입력", text.includes("한국인공지능협회"));
  step("마감일 자동 입력", text.includes("2026.10.20") || text.includes("10.20"));

  await p.goto(`${p.url().split("?")[0]}?tab=ai`);
  text = await p.locator("main").innerText();
  step("공고문이 문서로 저장되고 분석까지 완료", text.includes("공고문 분석") || text.includes("AI Summary"));

  const criteriaPage = await p.goto(`${p.url().split("?")[0]}?tab=overview`);
  text = await p.locator("main").innerText();
  step("평가 기준 자동 등록", /창의성|실현 가능성/.test(text), criteriaPage ? "" : "");

  // 2) 공고문 붙여넣기로 등록
  await p.goto(`${BASE}/activities/new`);
  await p.getByRole("button", { name: /공고문 붙여넣기/ }).click();
  await p.getByLabel("공고문 내용").fill(pasted);
  await p.getByRole("button", { name: /자동으로 활동 만들기/ }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/, { timeout: 90000 });
  text = await p.locator("main").innerText();
  step("붙여넣기로 활동 생성", text.includes("그린테크 아이디어 공모전"), text.split("\n")[0]);
  step("주최 추출", text.includes("한국환경산업기술원"));
  step("종류를 공모전으로 판단", text.includes("공모전"));
  step("마감일 추출", text.includes("2026.10.31") || text.includes("10.31"));

  // 3) 내용이 너무 짧으면 실행 자체를 막는다
  await p.goto(`${BASE}/activities/new`);
  await p.getByRole("button", { name: /공고문 붙여넣기/ }).click();
  const run = p.getByRole("button", { name: /자동으로 활동 만들기/ });
  step("빈 입력에서는 실행 불가", await run.isDisabled());
  await p.getByLabel("공고문 내용").fill("짧은 글");
  step("내용이 부실하면 실행 불가", await run.isDisabled());
  await p.getByLabel("공고문 내용").fill(pasted);
  step("충분한 공고문이면 실행 가능", !(await run.isDisabled()));
} catch (e) {
  step(`예외: ${String(e).split("\n")[0].slice(0, 130)}`, false);
} finally {
  await b.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
