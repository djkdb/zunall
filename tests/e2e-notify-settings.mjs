/** 알림 설정 + 주간 리포트 E2E. 실행: node tests/e2e-notify-settings.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const dday = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(30000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("알림설정");
  await p.getByLabel("이메일").fill(`notify-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("notifypass123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  // D-3 마감 활동을 만들어 둔다
  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill("알림 테스트 공모전");
  await p.getByLabel("상태").selectOption("planned");
  await p.getByLabel("접수(지원) 마감일").fill(dday(3));
  await p.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);

  await p.goto(`${BASE}/notifications?filter=all`);
  step("기본 설정에서 D-3 알림 생성", (await p.locator("main").innerText()).includes("D-3"));

  // ── 설정 화면 ──────────────────────────────────────────────
  await p.goto(`${BASE}/settings`);
  const settingsText = await p.locator("main").innerText();
  step("알림 설정 카드 노출", settingsText.includes("마감 며칠 전에 알릴까요"));
  step("주간 리포트 설정 노출", settingsText.includes("주간 리포트 받기"));

  // D-3 을 끄고 저장
  await p.getByRole("button", { name: "D-3", exact: true }).click();
  await p.getByRole("button", { name: "알림 설정 저장" }).click();
  await p.waitForTimeout(1500);
  step("저장 확인 표시", (await p.locator("main").innerText()).includes("저장했습니다"));

  await p.reload();
  step("새로고침해도 설정 유지", (await p.getByRole("button", { name: "D-3", exact: true }).getAttribute("aria-pressed")) === "false");

  // 새 활동을 만들어도 D-3 알림이 더는 생기지 않는다
  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill("두 번째 공모전");
  await p.getByLabel("상태").selectOption("planned");
  await p.getByLabel("접수(지원) 마감일").fill(dday(3));
  await p.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);

  await p.goto(`${BASE}/notifications?filter=all`);
  const after = await p.locator("main").innerText();
  step("끈 임계일은 알림이 생기지 않음", !after.includes("두 번째 공모전"), after.split("\n").find((l) => l.includes("두 번째")) ?? "");

  // ── 조용한 시간 ────────────────────────────────────────────
  await p.goto(`${BASE}/settings`);
  await p.getByLabel("조용한 시간에는 푸시를 보내지 않기").check();
  await p.waitForTimeout(300);
  step("조용한 시간 입력 노출", (await p.getByLabel("조용한 시간 시작").count()) === 1);
  await p.getByLabel("조용한 시간 시작").selectOption("23");
  await p.getByRole("button", { name: "알림 설정 저장" }).click();
  await p.waitForTimeout(1500);
  await p.reload();
  step("조용한 시간 유지", (await p.getByLabel("조용한 시간 시작").inputValue()) === "23");

  // ── 알림 종류 끄기 ─────────────────────────────────────────
  await p.getByRole("button", { name: "새 공고", exact: true }).click();
  await p.getByRole("button", { name: "알림 설정 저장" }).click();
  await p.waitForTimeout(1500);
  await p.reload();
  step(
    "알림 종류 설정 유지",
    (await p.getByRole("button", { name: "새 공고", exact: true }).getAttribute("aria-pressed")) === "false",
  );

  // ── 주간 리포트 요일 ───────────────────────────────────────
  await p.getByLabel("주간 리포트 요일").selectOption("3");
  await p.getByRole("button", { name: "알림 설정 저장" }).click();
  await p.waitForTimeout(1500);
  await p.reload();
  step("주간 리포트 요일 유지", (await p.getByLabel("주간 리포트 요일").inputValue()) === "3");

  // ── 주간 리포트 실제 생성 (크론) ───────────────────────────
  // 오늘 요일로 맞춰두고 크론을 돌리면 리포트가 만들어져야 한다
  const todayWeekday = new Date().getDay();
  await p.getByLabel("주간 리포트 요일").selectOption(String(todayWeekday));
  await p.getByRole("button", { name: "알림 설정 저장" }).click();
  await p.waitForTimeout(1500);

  const cronKey = process.env.CRON_KEY ?? "test-cron-key";
  const cron = await p.request.get(`${BASE}/api/cron/daily?key=${cronKey}`);
  const cronBody = await cron.json().catch(() => ({}));
  step("크론 실행", cron.ok(), JSON.stringify(cronBody));
  step("주간 리포트 생성됨", (cronBody.weekly ?? 0) >= 1, `weekly=${cronBody.weekly}`);

  await p.goto(`${BASE}/notifications?filter=all`);
  const inbox = await p.locator("main").innerText();
  step("알림함에 주간 리포트", inbox.includes("주간 리포트"), inbox.split("\n").find((l) => l.includes("주간")) ?? "");
  step("이번 주 마감이 리포트에 담김", inbox.includes("알림 테스트 공모전") || inbox.includes("이번 주 마감"));

  // 같은 주에 두 번 보내지 않는다
  const again = await (await p.request.get(`${BASE}/api/cron/daily?key=${cronKey}`)).json();
  await p.goto(`${BASE}/notifications?filter=all`);
  const count = ((await p.locator("main").innerText()).match(/주간 리포트/g) ?? []).length;
  step("같은 주에는 한 번만", count === 1 && (again.weekly ?? 0) === 0, `${count}건 (두 번째 실행 weekly=${again.weekly})`);

  // ── 끄면 만들지 않는다 ─────────────────────────────────────
  await p.goto(`${BASE}/settings`);
  await p.getByLabel("주간 리포트 받기").uncheck();
  await p.getByRole("button", { name: "알림 설정 저장" }).click();
  await p.waitForTimeout(1500);
  await p.reload();
  step("주간 리포트 끄기 유지", !(await p.getByLabel("주간 리포트 받기").isChecked()));
} catch (e) {
  step("예외", false, String(e).slice(0, 200));
} finally {
  await b.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
}
