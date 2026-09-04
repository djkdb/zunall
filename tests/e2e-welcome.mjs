/** 소개 화면(랜딩) + 쉬운 용어 E2E. 실행: node tests/e2e-welcome.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const ctx = await b.newContext();
const p = await ctx.newPage(); p.setDefaultTimeout(30000);
try {
  // ── 로그인 전: 첫 주소에서 소개 화면 ────────────────────────
  await p.goto(BASE, { waitUntil: "networkidle" });
  const landing = await p.locator("body").innerText();
  step("첫 주소에서 소개 화면", landing.includes("공모전") && landing.includes("대외활동"), landing.split("\n")[2] ?? "");
  step("주소는 그대로 /", new URL(p.url()).pathname === "/", p.url());
  step("무료임을 밝힘", landing.includes("무료"));
  step("무엇을 해주는지 설명", landing.includes("마감일") && landing.includes("자동으로 정리"));
  step("쓰는 순서 안내", landing.includes("이렇게 씁니다"));
  step("기능 목록", landing.includes("들어 있는 기능"));
  step("합격 예측 아님을 밝힘", landing.includes("합격을 예측하지 않습니다"));
  step("약관·방침 링크", landing.includes("이용약관") && landing.includes("개인정보처리방침"));
  step("가입 버튼", (await p.getByRole("link", { name: /무료로 시작하기/ }).count()) >= 1);

  // 로그인 화면에서도 소개로 갈 수 있다
  await p.goto(`${BASE}/login`);
  step("로그인 화면에 소개 링크", (await p.getByRole("link", { name: /어떤 서비스인지/ }).count()) === 1);
  await p.getByRole("link", { name: /어떤 서비스인지/ }).click();
  await p.waitForTimeout(1000);
  step("소개 화면으로 이동", (await p.locator("body").innerText()).includes("이렇게 씁니다"));

  // ── 가입 후에는 대시보드 ───────────────────────────────────
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("김대학");
  await p.getByLabel("이메일").fill(`welcome-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("welcomepass123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);
  await p.waitForTimeout(800);
  const dash = await p.locator("main").innerText();
  step("로그인하면 대시보드", !dash.includes("이렇게 씁니다") && dash.includes("김대학"));

  // 로그인 상태로 /welcome 에 가면 앱으로 돌려보낸다
  await p.goto(`${BASE}/welcome`);
  await p.waitForTimeout(800);
  step("로그인 상태에서 소개는 건너뜀", new URL(p.url()).pathname === "/");

  // ── 용어: 화면에 영어 전문용어가 남아 있지 않다 ─────────────
  await p.goto(`${BASE}/career`);
  await p.getByRole("button", { name: "공학·IT" }).click();
  await p.getByLabel("어떤 목표를 향해 가고 있나요? *").fill("프론트엔드 개발자");
  await p.getByRole("button", { name: "다음" }).click();
  await p.waitForTimeout(1200);
  await p.getByRole("button", { name: "다음" }).click();
  await p.waitForTimeout(1200);
  step("온보딩 마지막 버튼도 한국어", (await p.getByRole("button", { name: "내 커리어 시작하기" }).count()) === 1);
  await p.getByRole("button", { name: "내 커리어 시작하기" }).click();
  await p.waitForTimeout(3000);

  const jargon = ["Career Score", "Evidence", "Career Gap", "Opportunities", "Your Career"];
  for (const [name, path] of [["커리어", "/career"], ["대시보드", "/"], ["기회", "/opportunities"], ["부족한 부분", "/career/gaps"], ["스킬", "/career/skills"], ["통계", "/stats"]]) {
    await p.goto(`${BASE}${path}`);
    const text = await p.locator("main").innerText();
    const left = jargon.filter((w) => text.includes(w));
    step(`${name} 화면 영어 용어 없음`, left.length === 0, left.join(", "));
  }

  await p.goto(`${BASE}/career`);
  const career = await p.locator("main").innerText();
  step("한국어 용어로 바뀜", career.includes("내 커리어") && career.includes("근거가 되는 경험"), "");
} catch (e) {
  step("예외", false, String(e).slice(0, 250));
} finally {
  await b.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
}
