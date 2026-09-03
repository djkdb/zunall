/** 데이터 내보내기/가져오기 E2E. 실행: node tests/e2e-backup.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
try {
  // A 계정: 데이터 만들고 내보내기
  const a = await b.newPage(); a.setDefaultTimeout(30000);
  const emailA = `bak-a-${Date.now()}@test.local`;
  await a.goto(`${BASE}/signup`);
  await a.getByLabel("이름").fill("백업A");
  await a.getByLabel("이메일").fill(emailA);
  await a.getByLabel("비밀번호").fill("bakpass123!");
  await a.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await a.getByRole("button", { name: "회원가입" }).click();
  await a.waitForURL(`${BASE}/`);

  await a.goto(`${BASE}/activities/new`);
  await a.getByLabel("활동명 *").fill("백업 대상 공모전");
  await a.getByLabel("메모").fill("백업 확인용 메모");
  await a.getByLabel("태그 (쉼표로 구분)").fill("백업태그");
  await a.getByLabel("접수(지원) 마감일").fill("2026-12-01");
  await a.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await a.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  const activityUrl = a.url();

  await a.goto(`${activityUrl}?tab=essay`);
  await a.getByRole("button", { name: "문항 추가" }).click();
  await a.getByLabel("문항 *").fill("백업용 지원 동기 문항");
  await a.getByRole("button", { name: "추가", exact: true }).click();
  await a.waitForTimeout(1200);
  await a.locator("textarea").first().fill("백업 확인용 답변입니다. 숫자 42% 포함.");
  await a.getByRole("button", { name: "저장만" }).click();
  await a.waitForTimeout(1500);

  const backup = await a.evaluate(async (base) => {
    const res = await fetch(`${base}/api/export`);
    return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
  }, BASE);
  step("내보내기 응답", backup.status === 200 && (backup.type ?? "").includes("json"));
  const parsed = JSON.parse(backup.body);
  step("백업 형식", parsed.app === "cavero" && parsed.version === 1);
  step("활동 포함", parsed.data.activities.length === 1 && parsed.data.activities[0].name === "백업 대상 공모전");
  step("자소서 문항·답변 포함", parsed.data.essayQuestions.length === 1 && parsed.data.essayDrafts.length === 1);
  step("태그 포함", parsed.data.tags.some((t) => t.name === "백업태그"));
  await a.close();

  // B 계정: 가져오기
  const c = await b.newPage(); c.setDefaultTimeout(30000);
  await c.goto(`${BASE}/signup`);
  await c.getByLabel("이름").fill("백업B");
  await c.getByLabel("이메일").fill(`bak-b-${Date.now()}@test.local`);
  await c.getByLabel("비밀번호").fill("bakpass123!");
  await c.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await c.getByRole("button", { name: "회원가입" }).click();
  await c.waitForURL(`${BASE}/`);

  await c.goto(`${BASE}/settings`);
  step("설정에 백업 카드 노출", (await c.locator("main").innerText()).includes("데이터 백업"));
  await c.setInputFiles("input[type=file][accept*='json']", {
    name: "cavero-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup.body),
  });
  await c.waitForSelector("text=가져왔습니다", { timeout: 30000 });
  const msg = await c.locator("main").innerText();
  step("가져오기 결과 요약 표시", msg.includes("활동 1건"), msg.match(/가져왔습니다[^\n]*/)?.[0]?.slice(0, 60));

  await c.goto(`${BASE}/activities`);
  step("가져온 활동 표시", (await c.locator("main").innerText()).includes("백업 대상 공모전"));

  await c.goto(`${BASE}/search?q=${encodeURIComponent("백업 확인용 답변")}`);
  step("가져온 자소서 답변 검색됨", (await c.locator("main").innerText()).includes("백업용 지원 동기 문항"));

  // 잘못된 파일 거부
  await c.goto(`${BASE}/settings`);
  await c.setInputFiles("input[type=file][accept*='json']", {
    name: "wrong.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":"world"}'),
  });
  await c.waitForTimeout(2000);
  step("다른 형식 파일 거부", (await c.locator("main").innerText()).includes("Cavero 백업 파일이 아닙니다"));
  await c.close();
} catch (e) {
  step(`예외: ${String(e).split("\n")[0].slice(0, 130)}`, false);
} finally {
  await b.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
