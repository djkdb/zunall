/** 포트폴리오 공유 링크 + AI 사용량 상한 E2E. 실행: node tests/e2e-share-portfolio.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(40000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("공유포폴");
  await p.getByLabel("이메일").fill(`pf-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("pfpass123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  // 포트폴리오에 담길 활동 하나
  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill("공유용 공모전");
  await p.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  const activityUrl = p.url();
  // 기록 탭에서 역할·성과를 남겨야 포트폴리오에 실린다
  await p.goto(`${activityUrl}?tab=history`);
  await p.getByLabel("나의 역할").fill("팀장으로 기획을 총괄");
  await p.getByRole("button", { name: /저장/ }).first().click();
  await p.waitForTimeout(2500);

  // ── 공유 링크 만들기 ───────────────────────────────────────
  await p.goto(`${BASE}/portfolio`);
  step("공유 링크 카드 노출", (await p.locator("main").innerText()).includes("공유 링크"));
  await p.getByRole("button", { name: "공유 링크 만들기" }).click();
  await p.waitForTimeout(2000);
  const url = await p.getByLabel("포트폴리오 공유 주소").inputValue();
  step("주소 발급", url.includes("/p/"), url.replace(BASE, ""));

  // ── 로그아웃 상태에서도 열린다 ─────────────────────────────
  const guest = await b.newPage(); guest.setDefaultTimeout(30000);
  await guest.goto(url);
  const shared = await guest.locator("body").innerText();
  step("로그인 없이 열람", shared.includes("공유용 공모전"), shared.split("\n")[0]);
  step("본인 이름 표시", shared.includes("공유포폴"));
  step("Cavero 표기", shared.includes("Cavero"));

  // ── 주소를 새로 만들면 이전 주소는 막힌다 ──────────────────
  await p.getByRole("button", { name: "주소 새로 만들기" }).click();
  await p.waitForTimeout(2000);
  const newUrl = await p.getByLabel("포트폴리오 공유 주소").inputValue();
  step("주소가 바뀜", newUrl !== url);
  await guest.goto(url);
  step("이전 주소는 막힘", !(await guest.locator("body").innerText()).includes("공유용 공모전"));
  await guest.goto(newUrl);
  step("새 주소는 열림", (await guest.locator("body").innerText()).includes("공유용 공모전"));

  // ── 공유 중지 ──────────────────────────────────────────────
  await p.getByRole("button", { name: "공유 중지" }).click();
  await p.waitForTimeout(2000);
  await guest.goto(newUrl);
  step("중지하면 막힘", !(await guest.locator("body").innerText()).includes("공유용 공모전"));
  step("카드가 초기 상태로", (await p.locator("main").innerText()).includes("공유 링크 만들기"));
  await guest.close();

  // ── AI 사용량 상한 ─────────────────────────────────────────
  // 서버가 AI_DAILY_LIMIT=2 로 떠 있을 때만 검사한다
  if (process.env.AI_DAILY_LIMIT === "2") {
    await p.goto(`${activityUrl}?tab=essay`);
    await p.getByRole("button", { name: "문항 추가" }).click();
    await p.getByLabel("문항 *").fill("지원 동기를 적어주세요.");
    await p.getByRole("button", { name: "추가", exact: true }).click();
    await p.waitForTimeout(1500);

    for (let i = 0; i < 3; i++) {
      await p.getByRole("textbox", { name: /답변/ }).first()
        .fill(`저는 이 활동을 통해 배운 것을 정리하고 싶어 지원했습니다. 시도 ${i + 1}회차 답변입니다.`);
      await p.getByRole("button", { name: /첨삭/ }).first().click();
      await p.waitForTimeout(6000);
    }
    const limited = await p.locator("main").innerText();
    step("상한을 넘으면 막고 안내", limited.includes("오늘 AI 사용 횟수를 모두 썼습니다"), limited.split("\n").find((l) => l.includes("AI 사용")) ?? "");
  } else {
    // 상한을 켠 서버에서만 검사한다 (공용 서버에 걸면 다른 테스트가 막힌다):
    //   AI_DAILY_LIMIT=2 로 서버를 띄우고 AI_DAILY_LIMIT=2 node tests/e2e-share-portfolio.mjs
    step("AI 상한 검사 건너뜀 (AI_DAILY_LIMIT 미설정)", true);
  }
} catch (e) {
  step("예외", false, String(e).slice(0, 250));
} finally {
  await b.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
}
