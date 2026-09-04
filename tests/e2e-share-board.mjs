/** 공유로 공고 등록 + 지원 현황 보드 E2E. 실행: node tests/e2e-share-board.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const SITE = process.env.SITE ?? "http://127.0.0.1:8795";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(40000);
const email = `share-${Date.now()}@test.local`;
try {
  // ── 로그인 전에 공유가 들어오면 로그인 후 그대로 이어진다 ──
  await p.goto(`${BASE}/share?url=${encodeURIComponent(`${SITE}/notice`)}`);
  step("로그인 안 했으면 로그인으로", new URL(p.url()).pathname === "/login");
  step("공유 내용을 들고 감", p.url().includes("next=") && decodeURIComponent(p.url()).includes("/share?url="));

  await p.goto(`${BASE}/signup?next=${encodeURIComponent(`/share?url=${encodeURIComponent(`${SITE}/notice`)}`)}`);
  await p.getByLabel("이름").fill("공유");
  await p.getByLabel("이메일").fill(email);
  await p.getByLabel("비밀번호").fill("sharepass123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(/\/share/, { timeout: 30000 });
  step("가입 후 공유 화면으로 복귀", p.url().includes("/share"));

  // ── 공유 화면: 주소가 채워져 있고 등록하면 활동이 생긴다 ──
  step("공유된 주소가 채워짐", (await p.getByLabel("공고 주소").inputValue()).includes("/notice"));
  await p.getByRole("button", { name: "자동으로 활동 만들기" }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/, { timeout: 90000 });
  const detail = await p.locator("main").innerText();
  step("공유만으로 활동 생성", detail.length > 0 && !detail.includes("Application error"));
  step("공고 내용이 반영됨", detail.includes("공모전") || detail.includes("한국인공지능협회"), detail.split("\n")[0]);

  // ── 텍스트만 공유해도 등록된다 ─────────────────────────────
  const pasted = [
    "2026 사회혁신 아이디어 공모전 참가자 모집 공고",
    "주최: 테스트재단",
    "접수기간: 2026.10.01 ~ 2026.11.30",
    "지원 마감: 2026년 11월 30일",
    "제출 마감: 2026년 12월 15일",
    "지원 자격: 국내 대학 재학생 및 휴학생, 3인 이내 팀",
    "제출 서류: 참가신청서, 아이디어 기획서(PDF 10p 이내)",
    "심사 기준: 창의성 40%, 실현 가능성 35%, 사회적 효과 25%",
  ].join("\n");
  await p.goto(`${BASE}/share?text=${encodeURIComponent(pasted)}`);
  step("주소 없으면 공고문 입력칸", (await p.getByLabel("공고문").count()) === 1);
  await p.getByRole("button", { name: "자동으로 활동 만들기" }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/, { timeout: 90000 });
  step("공고문 공유로도 생성", (await p.locator("main").innerText()).includes("사회혁신"));

  // ── 지원 현황 보드 ─────────────────────────────────────────
  await p.goto(`${BASE}/activities`);
  step("보드 전환 버튼", (await p.getByRole("link", { name: /지원 현황 보드/ }).count()) === 1);
  await p.getByRole("link", { name: /지원 현황 보드/ }).click();
  await p.waitForTimeout(1500);
  let board = await p.locator("main").innerText();
  step("보드에 상태 열이 보임", board.includes("관심") && board.includes("지원 완료") && board.includes("수상"));
  step("활동 카드가 보드에 있음", board.includes("사회혁신"));

  // 카드의 상태 바꾸기 (드래그 대체 수단)
  await p.getByLabel(/상태 바꾸기/).first().selectOption("applied");
  await p.waitForTimeout(2500);
  await p.reload();
  await p.waitForTimeout(1000);
  const applied = await p.locator("main").innerText();
  step("상태 변경이 저장됨", applied.includes("지원 완료"));

  // 목록으로 돌아가도 필터가 유지된다
  await p.goto(`${BASE}/activities?view=board&filter=ongoing`);
  await p.getByRole("link", { name: /목록/ }).click();
  await p.waitForTimeout(1200);
  step("목록으로 전환하면서 필터 유지", p.url().includes("filter=ongoing") && !p.url().includes("view=board"), p.url());
} catch (e) {
  step("예외", false, String(e).slice(0, 250));
} finally {
  await b.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
}
