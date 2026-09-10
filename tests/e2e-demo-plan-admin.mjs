/**
 * 요금 안내 + 둘러보기(데모) + 운영 지표 E2E.
 * 실행: node tests/e2e-demo-plan-admin.mjs
 * (서버에 ADMIN_EMAILS=admin@cavero.test 가 설정돼 있어야 운영 지표 항목이 통과한다)
 */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@cavero.test";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const ctx = await b.newContext();
const p = await ctx.newPage(); p.setDefaultTimeout(30000);
try {
  // ── 1. 소개 화면의 요금 안내 ────────────────────────────────
  await p.goto(BASE, { waitUntil: "networkidle" });
  const landing = await p.locator("body").innerText();
  step("요금 안내가 있다", landing.includes("요금"));
  step("지금은 무료임을 밝힘", landing.includes("무료"));
  step("유료 계획도 함께 밝힘", landing.includes("나중") || landing.includes("유료"));
  step("기능별 비교표", landing.includes("활동 관리") && landing.includes("AI"));
  step("둘러보기 버튼", (await p.getByRole("link", { name: /가입 없이 둘러보기/ }).count()) >= 1);

  // ── 2. 둘러보기 ────────────────────────────────────────────
  await p.getByRole("link", { name: /가입 없이 둘러보기/ }).first().click();
  await p.waitForURL(/\/\?demo=1/, { timeout: 30000 });
  await p.waitForTimeout(1200);
  step("가입 없이 앱으로 들어옴", new URL(p.url()).pathname === "/");

  const banner = await p.locator("main").innerText();
  step("둘러보기 안내 띠", banner.includes("둘러보기 중입니다"));
  step("임시 계정임을 밝힘", banner.includes("임시") && banner.includes("지워집니다"));
  step("내 계정 만들기 링크", (await p.getByRole("link", { name: /내 계정 만들기/ }).count()) >= 1);
  step("빈 화면이 아니다", banner.includes("그린테크"));

  // 예시 자료가 각 화면에 실제로 채워져 있다
  await p.goto(`${BASE}/activities`);
  await p.waitForTimeout(800);
  const acts = await p.locator("main").innerText();
  step("활동 3건", acts.includes("그린테크") && acts.includes("마케팅") && acts.includes("네이버"));

  await p.goto(`${BASE}/career`);
  await p.waitForTimeout(1500);
  const career = await p.locator("main").innerText();
  step("커리어 정보가 채워져 있음", !career.includes("시작하기 전에") && career.includes("경험"));

  await p.goto(`${BASE}/essays`);
  await p.waitForTimeout(800);
  const essays = await p.locator("main").innerText();
  step("자기소개서 예시 2건", essays.includes("갈등") && essays.includes("지원 동기"));

  // 이 서비스의 차이 — "지원하지 마세요"라고 말하는 화면이 둘러보기에 보여야 한다
  await p.goto(`${BASE}/opportunities`);
  await p.waitForTimeout(1000);
  const opp = await p.locator("main").innerText();
  step("말리는 공고가 목록에 있다", opp.includes("광고 공모전"), opp.split("\n")[0]);

  await p.getByRole("link", { name: /광고 공모전/ }).first().click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}/, { timeout: 30000 });
  await p.goto(`${p.url().split("?")[0]}?tab=fit`);
  await p.waitForTimeout(1200);
  const fit = await p.locator("main").innerText();
  step("적합도 점수가 보임", /\d+\s*\/\s*100/.test(fit));
  step("지원 비추천이라고 말함", fit.includes("지원 비추천"), fit.includes("지원 비추천") ? "" : fit.slice(0, 80));
  step("붙을 수는 있다고 인정함", fit.includes("합격 가능성은 높지만"));
  step("준비 시간을 근거로 듦", fit.includes("28시간"));
  step("대신 할 일을 제시함", fit.includes("지금 더 효과적인 대안") && fit.includes("문제 정의"));

  await p.goto(`${BASE}/calendar`);
  await p.waitForTimeout(800);
  step("캘린더에 일정", (await p.locator("main").innerText()).includes("마감"));

  // 둘러보기 계정은 운영 지표에 들어갈 수 없다
  const demoAdmin = await p.goto(`${BASE}/admin`);
  step("둘러보기 계정은 운영 지표 못 봄", demoAdmin.status() === 404, String(demoAdmin.status()));

  // 둘러보기를 두 번 하면 서로 다른 계정이다
  const ctx2 = await b.newContext();
  const p2 = await ctx2.newPage(); p2.setDefaultTimeout(30000);
  await p2.goto(`${BASE}/demo`);
  await p2.waitForTimeout(1500);
  await p2.goto(`${BASE}/activities`);
  await p2.waitForTimeout(800);
  // 첫 번째 둘러보기에서 활동 하나를 지워도 두 번째에는 그대로 있다 → 계정이 분리돼 있다
  step("둘러보기끼리 자료가 섞이지 않음", (await p2.locator("main").innerText()).includes("그린테크"));
  await ctx2.close();

  // ── 3. 일반 계정: 요금 카드는 보이고 운영 지표는 없다 ────────
  const ctx3 = await b.newContext();
  const p3 = await ctx3.newPage(); p3.setDefaultTimeout(30000);
  await p3.goto(`${BASE}/signup`);
  await p3.getByLabel("이름").fill("이일반");
  await p3.getByLabel("이메일").fill(`plan-${Date.now()}@test.local`);
  await p3.getByLabel("비밀번호").fill("planpass123!");
  await p3.locator('input[name="agree"]').check();
  await p3.getByRole("button", { name: "회원가입" }).click();
  await p3.waitForURL(`${BASE}/`);
  await p3.waitForTimeout(800);

  step("일반 계정에는 안내 띠 없음", !(await p3.locator("main").innerText()).includes("둘러보기 중입니다"));

  await p3.goto(`${BASE}/settings`);
  await p3.waitForTimeout(1000);
  const settings = await p3.locator("main").innerText();
  step("설정에 요금 카드", settings.includes("요금"));
  step("AI 사용 한도 안내", /하루 \d+회|횟수 제한 없이/.test(settings));

  step("일반 계정 사이드바에 운영 지표 없음", (await p3.getByRole("link", { name: "운영 지표" }).count()) === 0);
  const denied = await p3.goto(`${BASE}/admin`);
  step("일반 계정은 운영 지표 못 봄", denied.status() === 404, String(denied.status()));
  await ctx3.close();

  // ── 3-1. 진단: 조용히 죽는 설정을 health 가 알려준다 ────────
  const health = await (await fetch(`${BASE}/api/health`)).json();
  step("health 가 기능 설정을 보고", typeof health.features === "object" && health.features !== null);
  step("둘러보기 상태 보고", health.features?.demoMode === "on" || health.features?.demoMode === "off");
  step("운영자 설정 보고", health.features?.adminEmailsSet === true,
    `adminEmailsSet=${health.features?.adminEmailsSet}`);
  step("설정값 자체는 노출하지 않음",
    !JSON.stringify(health.features ?? {}).includes(ADMIN_EMAIL));
  step("빠진 설정은 안내로 알려줌",
    health.features?.cronKeySet === true || (health.notices ?? []).some((n) => n.includes("CRON_KEY")));

  // ── 4. 운영자 계정 ─────────────────────────────────────────
  const ctx4 = await b.newContext();
  const p4 = await ctx4.newPage(); p4.setDefaultTimeout(30000);
  await p4.goto(`${BASE}/signup`);
  await p4.getByLabel("이름").fill("관리자");
  await p4.getByLabel("이메일").fill(ADMIN_EMAIL);
  await p4.getByLabel("비밀번호").fill("adminpass123!");
  await p4.locator('input[name="agree"]').check();
  await p4.getByRole("button", { name: "회원가입" }).click();
  await p4.waitForTimeout(2000);
  if (!p4.url().endsWith("/")) {
    // 이미 있는 계정이면 로그인으로
    await p4.goto(`${BASE}/login`);
    await p4.getByLabel("이메일").fill(ADMIN_EMAIL);
    await p4.getByLabel("비밀번호").fill("adminpass123!");
    await p4.getByRole("button", { name: "로그인" }).click();
    await p4.waitForURL(`${BASE}/`, { timeout: 30000 });
  }
  await p4.waitForTimeout(800);

  step("운영자 사이드바에 운영 지표", (await p4.getByRole("link", { name: "운영 지표" }).count()) === 1);
  await p4.goto(`${BASE}/admin`);
  await p4.waitForTimeout(1200);
  const admin = await p4.locator("main").innerText();
  step("운영 지표 화면", admin.includes("운영 지표"));
  step("가입자 수", admin.includes("전체 가입"));
  step("사용 정도", admin.includes("활동을 1개 이상 등록"));
  step("기능별 지표", admin.includes("자기소개서 답변") && admin.includes("면접 질문"));
  step("전공·활동 분포", admin.includes("전공 계열") && admin.includes("활동 종류"));
  step("둘러보기 계정은 제외한다고 밝힘", admin.includes("둘러보기 계정") && admin.includes("빼고"));

  // 개인이 쓴 내용은 한 글자도 없어야 한다
  const leaked = ["그린테크", "@demo.local", "@test.local", "이일반"];
  step("개인 자료가 새지 않음", leaked.every((word) => !admin.includes(word)),
    leaked.filter((word) => admin.includes(word)).join(",") || "없음");
  await ctx4.close();
} catch (error) {
  step("예외 없이 완료", false, error.message);
} finally {
  await ctx.close();
  await b.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} 통과`);
process.exit(failed > 0 ? 1 : 0);
