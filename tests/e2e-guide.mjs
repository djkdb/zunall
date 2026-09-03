/** 시작 가이드 E2E. 실행: node tests/e2e-guide.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(40000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("가이드");
  await p.getByLabel("이메일").fill(`guide-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("guidepass123!");
  await p.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  let text = await p.locator("main").innerText();
  step("대시보드에 시작 가이드 카드", text.includes("시작 가이드 0/5"), text.match(/시작 가이드 \d\/5/)?.[0]);
  step("다음에 할 일 버튼 제시", text.includes("목표 직무 정하기"));

  await p.goto(`${BASE}/guide`);
  text = await p.locator("main").innerText();
  step("가이드 페이지: 제품 설명", text.includes("Cavero는") && text.includes("마감을 관리"));
  step("5단계 안내", text.includes("1. 목표 직무를 정한다") && text.includes("5. 끝나면 회고를 남긴다"));
  step("각 단계에 '왜'가 붙어 있음", text.includes("없으면 그냥 일정 관리 앱이 됩니다"));
  step("기능 목록 소개", text.includes("이런 것도 됩니다") && text.includes("지원 적합도"));
  step("점수 설명 (합격 확률 아님)", text.includes("합격 확률이 아니라"));
  step("진행 상황 0/5", text.includes("진행 상황 0/5"));

  // 목표를 만들면 1단계가 완료로 바뀐다
  await p.goto(`${BASE}/career`);
  await p.getByLabel("어떤 목표를 향해 가고 있나요? *").fill("서비스 기획자");
  await p.getByRole("button", { name: "다음" }).click();
  await p.getByLabel("나를 한 줄로 표현하면?").fill("가이드 테스트");
  await p.getByRole("button", { name: "다음" }).click();
  await p.getByRole("button", { name: "기획", exact: true }).click();
  await p.getByRole("button", { name: "Career Profile 만들기" }).click();
  await p.waitForSelector("text=Career Readiness", { timeout: 30000 });

  await p.goto(`${BASE}/guide`);
  text = await p.locator("main").innerText();
  step("완료한 단계가 반영됨", text.includes("진행 상황 1/5"), text.match(/진행 상황 \d\/5/)?.[0]);

  await p.goto(BASE);
  text = await p.locator("main").innerText();
  step("대시보드 카드도 갱신", text.includes("시작 가이드 1/5"));

  // 위젯에서 끌 수 있다
  await p.getByLabel("대시보드 구성").click();
  await p.getByRole("checkbox").nth(0).uncheck();
  await p.getByRole("button", { name: "저장" }).click();
  await p.waitForTimeout(2000);
  await p.reload();
  text = await p.locator("main").innerText();
  step("가이드 카드 끄기 가능", !text.includes("시작 가이드"));
} catch (e) {
  step(`예외: ${String(e).split("\n")[0].slice(0, 130)}`, false);
} finally {
  await b.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
