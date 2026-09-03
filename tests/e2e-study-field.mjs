/** 전공 계열·학과·희망 직무 개인화 E2E. 실행: node tests/e2e-study-field.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(30000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("문과생");
  await p.getByLabel("이메일").fill(`field-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("fieldpass123!");
  await p.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  // ── 온보딩: 상경 계열 + 학과 + 희망 직무 선택 ──────────────
  await p.goto(`${BASE}/career`);
  await p.getByRole("button", { name: "상경·경영" }).click();

  const roleButtons = await p.getByRole("button", { name: "마케터" }).count();
  step("계열을 고르면 그 계열 직무가 보임", roleButtons > 0);

  // 공학 계열 직무는 보이지 않아야 한다
  const engineerVisible = await p.getByRole("button", { name: "프론트엔드 개발자" }).count();
  step("다른 계열 직무는 숨겨짐", engineerVisible === 0);

  await p.getByLabel("학과 / 학부 (선택)").fill("경영학과");
  await p.getByRole("button", { name: "마케터" }).first().click();

  const goalValue = await p.locator("#ob-goal").inputValue();
  step("직무를 고르면 목표가 자동 입력됨", goalValue.length > 0, goalValue);

  await p.getByRole("button", { name: "다음" }).click();
  await p.waitForTimeout(1200);

  // 프로필 단계
  await p.getByLabel("나를 한 줄로 표현하면?").fill("마케팅 지망생");
  await p.getByRole("button", { name: "다음" }).click();
  await p.waitForTimeout(1200);

  // 스킬 단계: 상경 계열 스킬이 보이고, 공학 전용 스킬은 없어야 한다
  const skillText = await p.locator("main").innerText();
  step("계열 스킬 노출 (마케팅)", skillText.includes("마케팅"));
  step("타 계열 전용 스킬은 숨김 (Frontend)", !skillText.includes("Frontend"));

  await p.locator("button", { hasText: "마케팅" }).first().click();
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: "Career Profile 만들기" }).click();
  await p.waitForTimeout(2500);

  // ── 저장 확인: 커리어 화면에 기준이 표시된다 ────────────────
  await p.goto(`${BASE}/career`);
  const careerText = await p.locator("main").innerText();
  step("커리어 화면에 기준 표시", careerText.includes("상경·경영") && careerText.includes("경영학과"), careerText.split("\n").find((l) => l.includes("기준")) ?? "");

  // ── 스킬 화면: 계열 필터가 적용된다 ─────────────────────────
  await p.goto(`${BASE}/career/skills`);
  const skillsPage = await p.locator("main").innerText();
  step("스킬 화면에 계열 필터 안내", skillsPage.includes("상경·경영 계열 기준"));

  // ── 활동 만들기: 계열 추천 활동이 뜬다 ──────────────────────
  await p.goto(`${BASE}/activities/new`);
  const newPage = await p.locator("main").innerText();
  step("계열 추천 활동 표시", newPage.includes("상경·경영 계열에서 많이 하는 활동"));
  await p.locator("button", { hasText: "마케팅·비즈니스 아이디어 공모전" }).first().click();
  await p.waitForTimeout(400);
  step("추천을 누르면 활동 유형이 맞춰짐", (await p.locator("#type").inputValue()) === "contest");

  // ── 설정에서 변경 ───────────────────────────────────────────
  await p.goto(`${BASE}/settings`);
  await p.getByRole("button", { name: "공학·IT" }).click();
  await p.getByLabel("학과 / 학부").fill("컴퓨터공학과");
  await p.getByRole("button", { name: "프론트엔드 개발자" }).click();
  await p.getByRole("button", { name: "저장", exact: true }).click();
  await p.waitForTimeout(2000);

  await p.goto(`${BASE}/career`);
  const after = await p.locator("main").innerText();
  step("설정에서 바꾼 기준이 반영됨", after.includes("공학·IT") && after.includes("컴퓨터공학과"));
  step("역할 템플릿도 바뀜", after.includes("프론트엔드 개발자"), after.split("\n").find((l) => l.includes("기준")) ?? "");

  await p.goto(`${BASE}/activities/new`);
  step(
    "추천 활동도 계열 따라 바뀜",
    (await p.locator("main").innerText()).includes("공학·IT 계열에서 많이 하는 활동"),
  );
} catch (e) {
  step("예외", false, String(e).slice(0, 200));
} finally {
  await b.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
}
