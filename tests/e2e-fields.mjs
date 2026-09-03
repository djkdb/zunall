/** 전공 계열별 목표·스킬 지원 E2E. 실행: node tests/e2e-fields.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(40000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("문과생");
  await p.getByLabel("이메일").fill(`field-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("fieldpass123!");
  await p.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  await p.goto(`${BASE}/career`);
  let text = await p.locator("main").innerText();
  step("온보딩에 전공 계열 선택", text.includes("전공 계열"));
  step("계열 8종 제공", text.includes("인문·어학") && text.includes("의약·보건") && text.includes("예술·체육"));

  // 인문·어학 선택 → 목표 예시가 그 계열로
  await p.getByRole("button", { name: "인문·어학", exact: true }).click();
  await p.waitForTimeout(500);
  text = await p.locator("main").innerText();
  step("계열별 목표 예시 제시", text.includes("언론 / 미디어 / PR"), text.match(/이런 목표를[^\n]*/)?.[0]);

  // 예시 클릭 → 목표 입력 채워짐
  await p.getByRole("button", { name: "언론 / 미디어 / PR" }).click();
  const goalValue = await p.locator("#ob-goal").inputValue();
  step("예시 클릭으로 목표 입력", goalValue.includes("언론"), goalValue);

  await p.getByRole("button", { name: "다음" }).click();
  await p.getByLabel("나를 한 줄로 표현하면?").fill("글로 사람을 움직이고 싶은 국문과 3학년");
  await p.getByRole("button", { name: "다음" }).click();
  await p.waitForSelector("text=보유하거나 키우고 싶은 스킬", { timeout: 20000 });

  text = await p.locator("main").innerText();
  step("스킬 목록이 계열 위주로 필터됨", text.includes("계열 스킬만 보고 있습니다"));
  step("문과 스킬 노출", text.includes("글쓰기") && text.includes("번역 / 통역"));
  step("IT 전용 스킬은 기본 숨김", !text.includes("Cloud / 배포"));

  await p.getByRole("button", { name: /전체 보기/ }).click();
  await p.waitForTimeout(300);
  text = await p.locator("main").innerText();
  step("전체 보기로 모든 스킬 표시", text.includes("Cloud / 배포"));

  await p.getByRole("button", { name: "글쓰기", exact: true }).click();
  await p.getByRole("button", { name: "자료 조사", exact: true }).click();
  await p.getByRole("button", { name: "Career Profile 만들기" }).click();
  await p.waitForSelector("text=Career Readiness", { timeout: 30000 });

  text = await p.locator("main").innerText();
  step("문과 목표로 템플릿 매칭", text.includes("언론") || text.includes("글쓰기"), text.match(/목표 [^\n]*/)?.[0]?.slice(0, 40));
  step("근거 없을 때 이유 설명", text.includes("근거가 아직 없어서"));
  step("자가 평가만으로도 0점은 아님", !/글쓰기[\s\S]{0,40}\b0\b/.test(text), "");

  await p.goto(`${BASE}/career/gaps`);
  text = await p.locator("main").innerText();
  step("문과 스킬에 맞는 추천 행동", /1,000자 글|현직자|판례|취재|리포트/.test(text), text.match(/추천 행동[\s\S]{0,60}/)?.[0]?.replace(/\n/g, " "));
} catch (e) {
  step(`예외: ${String(e).split("\n")[0].slice(0, 130)}`, false);
} finally {
  await b.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
