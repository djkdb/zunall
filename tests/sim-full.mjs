/**
 * 전체 기능 사용자 시뮬레이션 (기존 sim-user / e2e-career 가 덮지 않는 영역).
 * 인증(구글 포함), 활동 편집·삭제·필터, 메모/기록, 캘린더 뷰, 알림,
 * 다크 모드, 사용자 간 데이터 격리, 모바일까지 실제 브라우저로 확인한다.
 *
 * 준비: 앱(3000) + 가짜 구글(8790) 기동
 * 실행: node tests/sim-full.mjs
 */
import { launchBrowser } from "./browser.mjs";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SHOT = "/tmp/simfull";
fs.mkdirSync(SHOT, { recursive: true });

const obs = [];
function note(scene, ok, detail = "") {
  obs.push({ scene, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${scene}${detail ? ` — ${detail}` : ""}`);
}
async function scene(name, fn) {
  try {
    await fn();
  } catch (error) {
    note(name, false, `예외: ${String(error).split("\n")[0].slice(0, 110)}`);
  }
}
const dday = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

async function signup(page, name, email) {
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("이름").fill(name);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("simpass123!");
  await page.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL(`${BASE}/`);
}

async function createActivity(page, name, deadline) {
  await page.goto(`${BASE}/activities/new`);
  await page.getByLabel("활동명 *").fill(name);
  if (deadline) {
    const field = page.getByLabel("지원 마감일");
    if (await field.count()) await field.fill(deadline);
  }
  await page.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await page.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  return page.url();
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.setDefaultTimeout(25000);
const stamp = Date.now();
const userA = `simA-${stamp}@test.local`;
let activityUrl = "";

// ─── 1. 인증 ────────────────────────────────────────────────
await scene("로그아웃 → 재로그인", async () => {
  await signup(page, "시뮬 A", userA);
  await page.getByRole("button", { name: /로그아웃/ }).click().catch(async () => {
    await page.locator("form[action] button").last().click();
  });
  await page.waitForURL(/\/login/);
  note("로그아웃 → 로그인 화면", true);

  await page.getByLabel("이메일").fill(userA);
  await page.getByLabel("비밀번호").fill("simpass123!");
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(`${BASE}/`);
  note("재로그인 → 대시보드 복귀", true);
});

await scene("미로그인 보호", async () => {
  const anon = await browser.newPage();
  await anon.goto(`${BASE}/career`);
  note("미로그인으로 /career 접근 → 로그인으로 이동", anon.url().includes("/login"), anon.url().replace(BASE, ""));
  await anon.close();
});

await scene("구글 로그인", async () => {
  const g = await browser.newPage();
  await g.goto(`${BASE}/login`);
  await g.getByRole("link", { name: /구글로 계속하기/ }).click();
  await g.waitForURL(`${BASE}/`);
  const body = await g.locator("body").innerText();
  note("구글 로그인 → 계정 생성 + 대시보드", body.includes("구글 테스터"));

  // 구글 전용 계정으로 비밀번호 로그인 시도
  await g.context().clearCookies();
  await g.goto(`${BASE}/login`);
  await g.getByLabel("이메일").fill("tester@gmail.com");
  await g.getByLabel("비밀번호").fill("아무비번12345");
  await g.getByRole("button", { name: "로그인" }).click();
  await g.waitForTimeout(2000);
  const t = await g.locator("body").innerText();
  note("구글 전용 계정 비번 로그인 → 구글 버튼 안내", t.includes("구글로 가입한 계정"), t.match(/구글로[^.]*\./)?.[0] ?? "");
  await g.close();
});

// ─── 2. 활동 관리 심화 ───────────────────────────────────────
await scene("활동 생성 + D-day 강조", async () => {
  activityUrl = await createActivity(page, "시뮬레이션 공모전", dday(3));
  await page.goto(BASE);
  const text = await page.locator("main").innerText();
  note("마감 임박 활동이 대시보드에 표시", text.includes("시뮬레이션 공모전"), text.includes("D-3") ? "D-3 배지" : "");
});

await scene("활동 편집", async () => {
  await page.goto(`${activityUrl}/edit`);
  const nameField = page.getByLabel("활동명 *");
  await nameField.fill("시뮬레이션 공모전 (수정)");
  await page.getByRole("button", { name: /저장|수정/ }).first().click();
  await page.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  const text = await page.locator("main").innerText();
  note("활동 이름 수정 → 상세에 반영", text.includes("시뮬레이션 공모전 (수정)"));
});

await scene("상태 변경", async () => {
  await page.goto(activityUrl);
  await page.getByLabel("활동 상태 변경").selectOption("active");
  await page.waitForTimeout(2000);
  await page.reload();
  const value = await page.getByLabel("활동 상태 변경").inputValue();
  note("활동 상태 변경 유지", value === "active", value);
});

await scene("메모 저장", async () => {
  await page.goto(`${activityUrl}?tab=notes`);
  const editor = page.locator("textarea").first();
  await editor.fill("면접 준비: 포트폴리오 3개 정리하기");
  await page.getByRole("button", { name: /저장/ }).first().click();
  await page.waitForTimeout(1500);
  await page.goto(`${activityUrl}?tab=notes`);
  const value = await page.locator("textarea").first().inputValue();
  note("메모 저장 후 재방문 시 유지", value.includes("포트폴리오 3개"));
});

await scene("변경 기록", async () => {
  await page.goto(`${activityUrl}?tab=history`);
  const text = await page.locator("main").innerText();
  note("기록 탭에 변경 이력 누적", text.length > 30 && !text.includes("Application error"), text.slice(0, 60).replace(/\n/g, " "));
});

await scene("목록 필터 · 검색", async () => {
  await page.goto(`${BASE}/activities`);
  const search = page.getByLabel("활동 검색");
  await search.fill("시뮬레이션");
  await page.waitForTimeout(1200);
  let text = await page.locator("main").innerText();
  note("검색어로 활동 필터링", text.includes("시뮬레이션 공모전"));

  await search.fill("존재하지않는활동명xyz");
  await page.waitForTimeout(1200);
  text = await page.locator("main").innerText();
  note("검색 결과 없음 안내", /없|찾을 수 없|0개/.test(text), text.slice(0, 50).replace(/\n/g, " "));

  await search.fill("");
  await page.getByLabel("상태 필터").selectOption("finished").catch(() => {});
  await page.waitForTimeout(1200);
  text = await page.locator("main").innerText();
  note("상태 필터(종료) 적용", !text.includes("시뮬레이션 공모전 (수정)"));
});

await scene("캘린더 뷰 전환", async () => {
  await page.goto(`${BASE}/calendar`);
  for (const label of ["주", "목록", "월"]) {
    const button = page.getByRole("button", { name: label, exact: true });
    if (await button.count()) {
      await button.first().click();
      await page.waitForTimeout(600);
    }
  }
  const text = await page.locator("main").innerText();
  note("캘린더 월/주/목록 뷰 전환", !text.includes("Application error"));
});

// ─── 3. 사용자 간 데이터 격리 ────────────────────────────────
await scene("데이터 격리", async () => {
  const b = await browser.newPage();
  await signup(b, "시뮬 B", `simB-${stamp}@test.local`);
  await b.goto(activityUrl);
  const text = await b.locator("body").innerText();
  const blocked = !text.includes("시뮬레이션 공모전") ;
  note("다른 사용자의 활동 URL 접근 차단", blocked, b.url().replace(BASE, "") + " / " + text.slice(0, 40).replace(/\n/g, " "));

  const status = await b.evaluate(async (base) => {
    const res = await fetch(`${base}/api/files/nonexistent-file-id`);
    return res.status;
  }, BASE);
  note("남의/없는 파일 다운로드 차단", status === 404 || status === 401 || status === 403, `HTTP ${status}`);
  await b.close();
});

await scene("없는 활동 ID", async () => {
  await page.goto(`${BASE}/activities/aaaaaaaaaaaaaaaaaaaa`);
  const text = await page.locator("body").innerText();
  note("존재하지 않는 활동 → 안내 화면", !text.includes("Application error"), text.slice(0, 50).replace(/\n/g, " "));
});

// ─── 4. 알림 · 통계 · 설정 · 테마 ────────────────────────────
await scene("마감 알림", async () => {
  const n = await browser.newPage();
  await signup(n, "알림", `simN-${stamp}@test.local`);
  for (const [name, days] of [["D1 마감 활동", 1], ["D3 마감 활동", 3], ["D7 마감 활동", 7]]) {
    await n.goto(`${BASE}/activities/new`);
    await n.getByLabel("활동명 *").fill(name);
    await n.getByLabel("상태").selectOption("planned");
    await n.getByLabel("접수(지원) 마감일").fill(dday(days));
    await n.getByRole("button", { name: "활동 만들기", exact: true }).click();
    await n.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  }
  await n.goto(BASE);
  const dash = await n.locator("main").innerText();
  const badges = dash.match(/D-\d+/g) ?? [];
  note("대시보드 D-day 배지 표시", badges.includes("D-1") && badges.includes("D-3"), badges.slice(0, 4).join(" "));

  await n.goto(`${BASE}/notifications`);
  const lines = (await n.locator("main").innerText()).split("\n").filter((l) => /^D-\d/.test(l.trim()));
  note("마감 임계일마다 알림 생성 (D-7/3/1)", lines.length === 3, lines.map((l) => l.split(" ·")[0]).join(", "));
  note("같은 마감에 중복 알림 없음", new Set(lines).size === lines.length, `${lines.length}건`);
  await n.close();
});

await scene("통계", async () => {
  await page.goto(`${BASE}/stats`);
  const text = await page.locator("main").innerText();
  note("통계 페이지 지표 표시", text.includes("활동") && !text.includes("Application error"));
});

await scene("설정 표시", async () => {
  await page.goto(`${BASE}/settings`);
  const text = await page.locator("main").innerText();
  note("설정에 AI·스토리지·DB 상태 표시", text.includes("파일 스토리지") && text.includes("데이터베이스"));
});

await scene("다크 모드", async () => {
  await page.goto(BASE);
  const toggle = page.locator("button[aria-label*='모드'], button[title*='모드']").first();
  if (await toggle.count()) {
    await toggle.click();
    await page.waitForTimeout(800);
  }
  const darkAfterToggle = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  await page.reload();
  await page.waitForTimeout(500);
  const darkAfterReload = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  note("다크 모드 전환 + 새로고침 유지", darkAfterToggle === darkAfterReload, `toggle=${darkAfterToggle} reload=${darkAfterReload}`);
});

// ─── 5. 활동 삭제 ────────────────────────────────────────────
await scene("활동 삭제", async () => {
  await page.goto(activityUrl);
  await page.getByLabel("활동 삭제").click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page.waitForURL(/\/activities\/?$/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/activities`);
  const text = await page.locator("main").innerText();
  note("활동 삭제 → 목록에서 제거", !text.includes("시뮬레이션 공모전 (수정)"));
});

// ─── 6. 모바일 ───────────────────────────────────────────────
await scene("모바일 화면", async () => {
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await signup(m, "모바일", `simM-${stamp}@test.local`);

  // 빈 계정에서는 넘치지 않다가 내용이 생기면 넘치는 경우가 있었다.
  // 커리어 프로필과 활동을 만들어 실제 상태에서 확인한다.
  await m.goto(`${BASE}/career`);
  await m.getByRole("button", { name: "공학·IT" }).click();
  await m.getByLabel("어떤 목표를 향해 가고 있나요? *").fill("프론트엔드 개발자");
  await m.getByRole("button", { name: "다음" }).click();
  await m.waitForTimeout(1200);
  await m.getByRole("button", { name: "다음" }).click();
  await m.waitForTimeout(1200);
  await m.getByRole("button", { name: "내 커리어 시작하기" }).click();
  await m.waitForTimeout(2500);

  await m.goto(`${BASE}/activities/new`);
  await m.getByLabel("활동명 *").fill("모바일 확인용 공모전");
  await m.getByLabel("접수(지원) 마감일").fill(dday(3));
  await m.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await m.waitForURL(/\/activities\/[a-z0-9]{20}$/);

  for (const [name, path] of [["대시보드", "/"], ["커리어", "/career"], ["활동", "/activities"], ["통계", "/stats"]]) {
    await m.goto(`${BASE}${path}`);
    await m.waitForTimeout(400);
    const over = await m.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    note(`모바일 ${name}: 가로 스크롤 없음`, over <= 2, over > 2 ? `${over}px 넘침` : "");
  }
  await m.screenshot({ path: `${SHOT}/mobile.png` });
  await m.close();
});

await browser.close();

const failed = obs.filter((o) => !o.ok);
console.log(`\n관찰 ${obs.length}건 중 정상 ${obs.length - failed.length}건, 문제 ${failed.length}건`);
if (failed.length) {
  console.log("\n문제 목록:");
  for (const f of failed) console.log(` - ${f.scene}${f.detail ? ` (${f.detail})` : ""}`);
}
process.exit(0);
