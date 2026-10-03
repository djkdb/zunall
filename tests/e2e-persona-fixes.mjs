/**
 * 페르소나 시뮬레이션에서 고친 것들이 다시 깨지지 않는지. 실행: node tests/e2e-persona-fixes.mjs
 *
 * - 서연: 진로를 못 정한 사람에게 점수 대신 후보 비교 → 고르면 그때부터 준비도
 * - 민지: 3일 안 마감이 있으면 대시보드 맨 위에 "오늘 가장 급한 것"
 * - 다은: 탈락 단계를 적으면 통계가 어디서 막히는지 말해 준다
 */
import { launchBrowser, describePage } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`);
};
const inDays = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function signup(p, name) {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill(name);
  await p.getByLabel("이메일").fill(`fix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`);
  await p.getByLabel("비밀번호").fill("fixpass123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);
}

async function onboard(p, { field, goal }) {
  await p.goto(`${BASE}/career`);
  await p.getByRole("button", { name: field, exact: true }).click();
  await p.locator("#ob-goal").fill(goal);
  await p.getByRole("button", { name: "다음" }).click();
  await p.locator("#ob-headline").waitFor();
  await p.getByRole("button", { name: "다음" }).click();
  await p.getByRole("button", { name: "내 커리어 시작하기" }).click();
  await p.getByText("근거가 되는 경험").first().waitFor();
}

async function addActivity(p, a) {
  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill(a.name);
  if (a.type) await p.getByLabel("활동 종류").selectOption(a.type);
  if (a.status) await p.getByLabel("상태").selectOption(a.status);
  if (a.applyDeadline) await p.getByLabel("접수(지원) 마감일").fill(a.applyDeadline);
  await p.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  return p.url();
}

const b = await launchBrowser();
let p;
try {
  // ── 서연: 진로 탐색 ───────────────────────────────
  p = await b.newPage();
  p.setDefaultTimeout(30000);
  await signup(p, "탐색");
  await onboard(p, { field: "인문·어학", goal: "아직 잘 모르겠어요. 출판이나 콘텐츠 쪽?" });

  await p.goto(`${BASE}/`);
  let main = await p.locator("main").innerText();
  step("진로 미정이면 대시보드에 후보 비교가 뜸", main.includes("진로 탐색 중"));
  step("진로 미정이면 준비도 점수를 내밀지 않음", !main.includes("목표 준비도") && !/\d+\s*\/\s*100/.test(main));
  step("후보마다 먼저 해 볼 일이 있음", (main.match(/먼저 해 볼 일/g) ?? []).length >= 2);
  step("오늘의 한 걸음이 가짜 점수 효과를 말하지 않음", !main.includes("예상 효과") && main.includes("작은 실험"));

  await p.goto(`${BASE}/career/gaps`);
  step("부족한 부분에 '임시 기준' 안내", (await p.locator("main").innerText()).includes("임시로 적용한 결과"));

  await p.goto(`${BASE}/`);
  await p.locator("li", { hasText: "언론 / 미디어 / PR" }).first().getByRole("button", { name: "이 직무로 정하기" }).click();
  await p.getByText("목표 준비도").first().waitFor();
  main = await p.locator("main").innerText();
  step("직무를 고르면 그때부터 준비도를 보여줌", main.includes("목표 준비도") && !main.includes("진로 탐색 중"));
  step("목표 이름이 고른 직무로 바뀜", main.includes("🎯 언론 / 미디어 / PR") && !main.includes("🎯 아직 잘 모르겠어요"));
  await p.close();

  // ── 민지: 급한 마감 ───────────────────────────────
  p = await b.newPage();
  p.setDefaultTimeout(30000);
  await signup(p, "마감");
  await onboard(p, { field: "상경·경영", goal: "뷰티 브랜드 마케터" });
  await addActivity(p, { name: "광고 마케팅 공모전", type: "contest", status: "planned", applyDeadline: inDays(2) });
  await addActivity(p, { name: "이미 낸 공모전", type: "contest", status: "submitted", applyDeadline: inDays(1) });
  await p.goto(`${BASE}/`);
  main = await p.locator("main").innerText();
  const urgentAt = main.indexOf("오늘 가장 급한 것");
  step("3일 안 마감이 맨 위 '오늘 가장 급한 것'에 뜸", urgentAt !== -1 && main.includes("광고 마케팅 공모전 — 지원 마감 D-2"));
  step("이미 제출한 활동은 급한 것으로 고르지 않음", !main.includes("이미 낸 공모전 — 지원 마감"));
  step("급한 것이 커리어 카드보다 먼저", urgentAt !== -1 && urgentAt < main.indexOf("목표 준비도"));
  step("커리어 추천은 마감 뒤로 미룸", main.includes("마감 뒤에 할 한 걸음"));
  await p.close();

  // ── 다은: 탈락 단계 ───────────────────────────────
  p = await b.newPage();
  p.setDefaultTimeout(30000);
  await signup(p, "탈락");
  const lost = [];
  for (const name of ["A사 데이터 인턴", "B사 데이터 인턴", "C사 데이터 인턴"]) {
    lost.push(await addActivity(p, { name, type: "intern", status: "lost" }));
  }
  await p.goto(`${BASE}/stats`);
  main = await p.locator("main").innerText();
  step("단계를 안 적은 탈락이 있으면 적으라고 안내", main.includes("어느 단계였는지 적으면") && main.includes("A사 데이터 인턴"));

  for (const url of lost.slice(0, 2)) {
    await p.goto(url);
    const group = p.getByRole("group", { name: "탈락 단계" });
    await group.getByRole("button", { name: "서류", exact: true }).click();
    await group.getByRole("button", { name: "서류", exact: true, pressed: true }).waitFor();
  }
  await p.goto(`${BASE}/stats`);
  main = await p.locator("main").innerText();
  step("서류에서 막히면 서류부터 하라고 말함", main.includes("탈락 2건 중 2건이 서류 단계였습니다") && main.includes("자기소개서"));
  step("단계별 탈락 수가 보임", main.includes("서류 2건"));

  // 상태를 바꾸면 적어 둔 단계는 지워진다
  await p.goto(lost[0]);
  await p.getByLabel("활동 상태 변경").selectOption("waiting");
  await p.waitForTimeout(1500);
  await p.goto(`${BASE}/stats`);
  main = await p.locator("main").innerText();
  step("탈락이 아니게 되면 단계 집계에서 빠짐", !main.includes("서류 2건") && main.includes("서류 1건"));
} catch (error) {
  console.error(`❌ 실패 시점 — ${await describePage(p)}`);
  console.error(error);
  results.push(false);
} finally {
  await b.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
