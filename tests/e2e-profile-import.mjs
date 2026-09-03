/** 내 이력으로 프로필 채우기 E2E. 실행: node tests/e2e-profile-import.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const resume = `김지원 — 산업공학 3학년, 데이터로 문제를 푸는 사람
2025 교내 데이터 분석 공모전 대상 — 파이썬으로 3년치 지원서 6,000건을 분석해 이탈 구간을 찾음
2024 마케팅 서포터즈 3기 활동 — 인스타그램 콘텐츠 월 8회 제작, 팔로워 2,300명 증가
2024 교내 학회 웹사이트 개발 프로젝트 — React와 TypeScript로 프론트엔드 구현
ADsP 데이터분석 준전문가 자격증 취득
SQL과 Excel을 이용한 데이터 정리 및 대시보드 제작 경험`;

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(40000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("이력");
  await p.getByLabel("이메일").fill(`profile-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("profilepass123!");
  await p.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  // 온보딩
  await p.goto(`${BASE}/career`);
  await p.getByLabel("어떤 목표를 향해 가고 있나요? *").fill("데이터 분석가");
  await p.getByRole("button", { name: "다음" }).click();
  await p.getByLabel("나를 한 줄로 표현하면?").fill("데이터로 문제를 푸는 사람");
  await p.getByRole("button", { name: "다음" }).click();
  await p.getByRole("button", { name: "데이터 분석", exact: true }).click();
  await p.getByRole("button", { name: "Career Profile 만들기" }).click();
  await p.waitForSelector("text=Career Readiness", { timeout: 30000 });

  let text = await p.locator("main").innerText();
  const before = Number(text.match(/(\d+)\s*\/\s*100/)?.[1] ?? 0);
  step("정보 완성도 카드 노출", text.includes("정보 완성도"), `현재 ${before}점`);
  step("무엇을 채우면 좋은지 안내", text.includes("지금 채우면 좋은 것"));
  step("이력 붙여넣기 카드 노출", text.includes("내 이력으로 한 번에 채우기"));

  // 이력 붙여넣기 → 추출
  await p.getByLabel("이력 붙여넣기").fill(resume);
  await p.getByRole("button", { name: /붙여넣은 글에서 뽑기/ }).click();
  await p.waitForSelector("text=찾은 스킬", { timeout: 60000 });
  text = await p.locator("main").innerText();
  step("스킬 추출", /Python|SQL|데이터 분석/.test(text), text.match(/찾은 스킬[^\n]*/)?.[0]);
  step("근거 후보 추출", /찾은 근거 \d+건/.test(text), text.match(/찾은 근거 \d+건/)?.[0]);
  step("수상 항목을 인식", text.includes("수상"));

  // 저장
  await p.getByRole("button", { name: /고른 항목 저장/ }).click();
  await p.waitForSelector("text=저장했습니다", { timeout: 30000 });
  text = await p.locator("main").innerText();
  step("저장 결과 안내", /스킬 \d+개, 근거 \d+건/.test(text), text.match(/저장했습니다[^\n]*/)?.[0]?.slice(0, 60));

  await p.reload();
  await p.waitForTimeout(1000);
  text = await p.locator("main").innerText();
  const after = Number(text.match(/(\d+)\s*\/\s*100/)?.[1] ?? 0);
  step("근거가 쌓여 점수 상승", after > before, `${before} → ${after}`);
  step("완성도 항목이 채워짐", !text.includes("보유 스킬 0/5개"), "");

  await p.goto(`${BASE}/career/skills`);
  text = await p.locator("main").innerText();
  step("스킬 목록에 반영", /Python|SQL|데이터/.test(text));

  // 너무 짧은 입력은 막는다
  await p.goto(`${BASE}/career`);
  const shortBtn = p.getByRole("button", { name: /붙여넣은 글에서 뽑기/ });
  step("빈 입력은 실행 불가", await shortBtn.isDisabled());
} catch (e) {
  step(`예외: ${String(e).split("\n")[0].slice(0, 130)}`, false);
} finally {
  await b.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
