/** 캘린더 구독(.ics) E2E. 실행: node tests/e2e-calendar-ics.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(30000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("캘린더");
  await p.getByLabel("이메일").fill(`ics-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("icspass123!");
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill("아이캘 공모전, 본선");
  await p.getByLabel("접수(지원) 마감일").fill("2026-10-20");
  await p.getByLabel("발표일").fill("2026-11-20");
  await p.getByRole("button", { name: "활동 만들기" }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);

  await p.goto(`${BASE}/calendar`);
  step("구독 안내 카드 노출", (await p.getByRole("button", { name: "구독 주소 만들기" }).count()) > 0);
  await p.getByRole("button", { name: "구독 주소 만들기" }).click();
  await p.waitForSelector("text=/api/calendar/", { timeout: 20000 });
  const url = (await p.locator("code").first().innerText()).trim();
  step("구독 주소 생성", /\/api\/calendar\/[A-Za-z0-9_-]{20,}\.ics$/.test(url), url.replace(BASE, ""));

  const res = await p.evaluate(async (u) => {
    const r = await fetch(u);
    return { status: r.status, type: r.headers.get("content-type"), body: await r.text() };
  }, url);
  step("ics 응답 헤더", res.status === 200 && (res.type ?? "").includes("text/calendar"), res.type ?? "");
  step("마감·발표 일정 포함", res.body.includes("[지원 마감] 아이캘 공모전") && res.body.includes("[결과 발표]"));
  step("쉼표 이스케이프 유지", res.body.includes("공모전\\, 본선"));
  step("알림 포함", res.body.includes("BEGIN:VALARM"));

  const wrong = await p.evaluate(async (base) => (await fetch(`${base}/api/calendar/wrongtokenwrongtoken123.ics`)).status, BASE);
  step("잘못된 토큰 차단", wrong === 404, `HTTP ${wrong}`);

  // 주소 재발급 → 기존 주소 무효화
  await p.getByRole("button", { name: /주소 새로 만들기/ }).click();
  await p.waitForTimeout(1500);
  const newUrl = (await p.locator("code").first().innerText()).trim();
  step("주소 재발급 시 새 토큰", newUrl !== url);
  const oldStatus = await p.evaluate(async (u) => (await fetch(u, { cache: "no-store" })).status, url);
  step("이전 주소는 즉시 무효", oldStatus === 404, `HTTP ${oldStatus}`);
} catch (e) {
  step(`예외: ${String(e).split("\n")[0].slice(0, 120)}`, false);
} finally {
  await b.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
