/** 공고 자동 수집 E2E. 실행: node tests/e2e-notice-feed.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const SITE = process.env.LIST_SITE ?? "http://127.0.0.1:8796";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(40000);

/** 등록 폼이 닫혀 있으면 열고 값을 채워 제출한다 */
async function addSource(name, url, keywords) {
  if ((await p.getByLabel("공고 목록 주소").count()) === 0) {
    await p.getByRole("button", { name: "사이트 추가" }).click();
  }
  await p.getByLabel("이름").fill(name);
  await p.getByLabel("공고 목록 주소").fill(url);
  if (keywords) await p.getByLabel("키워드 (선택)").fill(keywords);
  await p.getByRole("button", { name: "등록하고 지금 확인" }).click();
  await p.waitForTimeout(3000);
}
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("수집");
  await p.getByLabel("이메일").fill(`feed-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("feedpass123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  // ── 수집 탭 ────────────────────────────────────────────────
  await p.goto(`${BASE}/opportunities?tab=feed`);
  step("수집 탭 노출", (await p.locator("main").innerText()).includes("관심 사이트"));

  // ── 사이트 등록 (HTML 목록) ────────────────────────────────
  await addSource("테스트 공모전 사이트", `${SITE}/`);

  let text = await p.locator("main").innerText();
  step("첫 확인에서 공고 수집", text.includes("그린테크"), text.split("\n").find((l) => l.includes("찾았")) ?? "");
  step("메뉴 링크는 수집 안 됨", !text.includes("홈으로"));
  step("페이지 번호 링크 제외", !/^\s*다음\s*$/m.test(text));

  const countBefore = (text.match(/공모전|해커톤/g) ?? []).length;
  step("여러 건 수집", countBefore >= 3, `${countBefore}건`);

  // 첫 확인은 알림을 보내지 않는다
  await p.goto(`${BASE}/notifications?filter=all`);
  step("첫 확인은 알림 없음", !(await p.locator("main").innerText()).includes("테스트 공모전 사이트에"));

  // ── 새 글이 올라오면 찾아낸다 ──────────────────────────────
  await p.goto(`${SITE}/add`); // 목록에 1건 추가
  await p.goto(`${BASE}/opportunities?tab=feed`);
  await p.getByRole("button", { name: "지금 확인" }).first().click();
  await p.waitForTimeout(3000);
  text = await p.locator("main").innerText();
  step("새 공고만 추가로 수집", text.includes("추가 공모전 1"), text.split("\n").find((l) => l.includes("찾았")) ?? "");
  step("중복 수집 없음", (text.match(/그린테크/g) ?? []).length === 1);

  // 두 번째부터는 알림이 온다
  await p.goto(`${BASE}/notifications?filter=all`);
  step("새 공고 알림 생성", (await p.locator("main").innerText()).includes("테스트 공모전 사이트에 새 공고"));

  // ── 활동으로 등록 ──────────────────────────────────────────
  await p.goto(`${BASE}/opportunities?tab=feed`);
  const firstTitle = (await p.locator("main a[target='_blank']").nth(1).innerText()).trim();
  await p.getByRole("button", { name: "활동으로 등록" }).first().click();
  await p.waitForTimeout(6000);
  await p.goto(`${BASE}/activities`);
  const acts = await p.locator("main").innerText();
  step("공고가 활동으로 등록됨", acts.includes("공모전") || acts.includes("해커톤"), firstTitle);

  await p.goto(`${BASE}/opportunities?tab=feed`);
  text = await p.locator("main").innerText();
  step("등록한 공고는 목록에서 빠짐", !text.includes(firstTitle), firstTitle);

  // ── 숨기기 ────────────────────────────────────────────────
  const before = (await p.locator("main").innerText()).match(/모집|안내/g)?.length ?? 0;
  await p.getByRole("button", { name: "숨기기" }).first().click();
  await p.waitForTimeout(1500);
  const after = (await p.locator("main").innerText()).match(/모집|안내/g)?.length ?? 0;
  step("숨기면 목록에서 사라짐", after < before, `${before} → ${after}`);

  // ── RSS 소스 ──────────────────────────────────────────────
  await addSource("RSS 피드", `${SITE}/feed.xml`, "해커톤");
  text = await p.locator("main").innerText();
  step("RSS 수집 동작", text.includes("해커톤"));
  step("키워드로 1건만 수집", text.includes("새 공고 1건"), text.split("\n").find((l) => l.includes("찾았")) ?? "");

  // ── 잘못된 주소 ────────────────────────────────────────────
  await addSource("잘못된 주소", "http://127.0.0.1:9/none");
  step("접속 실패는 오류로 안내", (await p.locator("main").innerText()).includes("접속하지 못했"));

  // ── 소스 삭제 ─────────────────────────────────────────────
  await p.goto(`${BASE}/opportunities?tab=feed`);
  const sourcesBefore = await p.getByRole("button", { name: "삭제" }).count();
  await p.getByRole("button", { name: "삭제" }).first().click();
  await p.waitForTimeout(1500);
  step("소스 삭제", (await p.getByRole("button", { name: "삭제" }).count()) === sourcesBefore - 1);
} catch (e) {
  step("예외", false, String(e).slice(0, 250));
} finally {
  await b.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
}
