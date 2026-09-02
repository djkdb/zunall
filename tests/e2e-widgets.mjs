/** 대시보드 위젯 구성 E2E. 실행: node tests/e2e-widgets.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(30000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("위젯");
  await p.getByLabel("이메일").fill(`widget-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("widgetpass123!");
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  let text = await p.locator("main").innerText();
  step("기본 대시보드에 요약 지표 표시", text.includes("진행 중인 활동"));
  step("기본 대시보드에 최근 알림 표시", text.includes("최근 알림"));
  step("구성 버튼 노출", (await p.getByLabel("대시보드 구성").count()) > 0);

  // 요약 지표와 알림 끄기
  await p.getByLabel("대시보드 구성").click();
  await p.getByRole("checkbox").nth(0).uncheck();      // 요약 지표
  await p.getByRole("checkbox").nth(6).uncheck();      // 최근 알림
  await p.getByRole("button", { name: "저장" }).click();
  await p.waitForTimeout(2000);
  await p.reload();
  text = await p.locator("main").innerText();
  step("끈 위젯(요약 지표) 사라짐", !text.includes("진행 중인 활동"));
  step("끈 위젯(최근 알림) 사라짐", !text.includes("최근 알림"));
  step("남긴 위젯은 유지", text.includes("다가오는 마감") || text.includes("해야 할 일"));

  // 새로고침해도 설정 유지
  await p.goto(`${BASE}/settings`);
  await p.goto(BASE);
  text = await p.locator("main").innerText();
  step("페이지를 옮겼다 와도 설정 유지", !text.includes("진행 중인 활동"));

  // 기본값 복원
  await p.getByLabel("대시보드 구성").click();
  await p.getByRole("button", { name: "기본값으로" }).click();
  await p.getByRole("button", { name: "저장" }).click();
  await p.waitForTimeout(2000);
  await p.reload();
  text = await p.locator("main").innerText();
  step("기본값 복원", text.includes("진행 중인 활동") && text.includes("최근 알림"));
} catch (e) {
  step(`예외: ${String(e).split("\n")[0].slice(0, 130)}`, false);
} finally {
  await b.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
