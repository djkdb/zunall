/** 회고(STAR) + 포트폴리오 내보내기 E2E. 실행: node tests/e2e-retro-portfolio.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(30000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("회고");
  await p.getByLabel("이메일").fill(`retro-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("retropass123!");
  await p.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  await p.goto(`${BASE}/portfolio`);
  step("포트폴리오 빈 상태 안내", (await p.locator("main").innerText()).includes("아직 기록이 없습니다"));

  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill("교내 데이터 분석 공모전");
  await p.getByLabel("주최기관").fill("컴퓨터공학과");
  await p.getByLabel("상태").selectOption("won");
  await p.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  const url = p.url();

  // 회고 작성
  await p.goto(`${url}?tab=history`);
  step("회고(STAR) 폼 노출", (await p.locator("main").innerText()).includes("활동 회고"));
  await p.locator("#retro-situation").fill("동아리 지원자 데이터가 엑셀로만 쌓여 활용되지 못했습니다.");
  await p.locator("#retro-task").fill("데이터 정리와 분석을 맡아 다음 모집 전략을 제안하는 것이 목표였습니다.");
  await p.locator("#retro-action").fill("파이썬으로 3년치 지원서를 정리하고, 이탈 구간을 찾아 지원 절차를 2단계로 줄였습니다.");
  await p.locator("#retro-result").fill("지원 완료율이 61%에서 88%로 올랐고 대상을 받았습니다.");
  await p.locator("#retro-learned").fill("문제를 정의하기 전에 데이터를 먼저 본다는 기준을 세웠습니다.");
  await p.locator("#retro-skills").fill("데이터 분석, 기획");
  await p.getByRole("button", { name: /회고 저장/ }).click();
  await p.waitForTimeout(2000);
  await p.reload();
  const saved = await p.locator("main").innerText();
  step("회고 저장 후 값 유지", saved.includes("지원 완료율이 61%") || (await p.locator("#retro-result").inputValue()).includes("61%"));

  // 커리어 근거로 연결됐는지
  await p.goto(`${BASE}/career/skills`);
  const skillsText = await p.locator("main").innerText();
  step("회고 스킬이 커리어 근거로 등록", skillsText.includes("데이터 분석"), "");

  // 포트폴리오에 반영
  await p.goto(`${BASE}/portfolio`);
  const portfolio = await p.locator("main").innerText();
  step("포트폴리오에 활동 표시", portfolio.includes("교내 데이터 분석 공모전"));
  step("STAR 내용 포함", portfolio.includes("상황") && portfolio.includes("결과") && portfolio.includes("88%"));
  step("수상 배지 표시", portfolio.includes("수상"));
  step("스킬 태그 표시", portfolio.includes("#데이터 분석"));
  step("인쇄 버튼 제공", (await p.getByRole("button", { name: /인쇄/ }).count()) > 0);

  // 인쇄 미디어에서 앱 껍데기가 숨는지
  await p.emulateMedia({ media: "print" });
  const sidebarVisible = await p.locator("aside").first().isVisible().catch(() => false);
  step("인쇄 시 사이드바 숨김", !sidebarVisible);
  await p.emulateMedia({ media: "screen" });
} catch (e) {
  step(`예외: ${String(e).split("\n")[0].slice(0, 130)}`, false);
} finally {
  await b.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
