/** 계정 관리(약관 동의·비밀번호 변경·탈퇴) E2E. 실행: node tests/e2e-account.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const email = `acct-${Date.now()}@test.local`;
const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(30000);
try {
  // ── 약관/개인정보 문서는 로그인 없이 볼 수 있어야 한다 ──────
  await p.goto(`${BASE}/terms`);
  step("이용약관 공개 열람", (await p.locator("body").innerText()).includes("제1조"));
  await p.goto(`${BASE}/privacy`);
  const privacy = await p.locator("body").innerText();
  step("개인정보처리방침 공개 열람", privacy.includes("수집하는 정보"));
  step("AI 전송 사실 명시", privacy.includes("Anthropic"));

  // ── 동의 없이 가입 불가 ────────────────────────────────────
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("계정");
  await p.getByLabel("이메일").fill(email);
  await p.getByLabel("비밀번호").fill("firstpass123!");
  const agree = p.locator('input[name="agree"]');
  step("가입 화면에 동의 체크박스", (await agree.count()) === 1);
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForTimeout(800);
  step("동의 안 하면 가입되지 않음", new URL(p.url()).pathname === "/signup");

  // ── 동의하고 가입 ──────────────────────────────────────────
  await agree.check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);
  step("동의 후 가입 성공", true);

  // ── 비밀번호 변경 ──────────────────────────────────────────
  await p.goto(`${BASE}/settings`);
  const settings = await p.locator("main").innerText();
  step("설정에 비밀번호 카드", settings.includes("비밀번호"));
  step("설정에 계정 삭제 카드", settings.includes("계정 삭제"));

  await p.getByLabel("현재 비밀번호").fill("wrongpass123!");
  await p.getByLabel("새 비밀번호", { exact: true }).fill("secondpass123!");
  await p.getByLabel("새 비밀번호 확인").fill("secondpass123!");
  await p.getByRole("button", { name: "비밀번호 변경" }).click();
  await p.waitForTimeout(1200);
  step("현재 비밀번호가 틀리면 거부", (await p.locator("main").innerText()).includes("올바르지 않습니다"));

  await p.getByLabel("현재 비밀번호").fill("firstpass123!");
  await p.getByLabel("새 비밀번호", { exact: true }).fill("secondpass123!");
  await p.getByLabel("새 비밀번호 확인").fill("secondpass123!");
  await p.getByRole("button", { name: "비밀번호 변경" }).click();
  await p.waitForTimeout(1500);
  step("비밀번호 변경 성공", (await p.locator("main").innerText()).includes("바꿨습니다"));

  // 새 비밀번호로 다시 로그인된다
  const p2 = await b.newPage(); p2.setDefaultTimeout(30000);
  await p2.goto(`${BASE}/login`);
  await p2.getByLabel("이메일").fill(email);
  await p2.getByLabel("비밀번호").fill("secondpass123!");
  await p2.getByRole("button", { name: "로그인" }).click();
  await p2.waitForURL(`${BASE}/`);
  step("새 비밀번호로 로그인", true);

  // 옛 비밀번호는 막힌다
  const p3 = await b.newPage(); p3.setDefaultTimeout(30000);
  await p3.goto(`${BASE}/login`);
  await p3.getByLabel("이메일").fill(email);
  await p3.getByLabel("비밀번호").fill("firstpass123!");
  await p3.getByRole("button", { name: "로그인" }).click();
  await p3.waitForTimeout(1200);
  step("옛 비밀번호는 거부", new URL(p3.url()).pathname === "/login");
  await p3.close();

  // ── 재설정 화면 ────────────────────────────────────────────
  await p3.close().catch(() => {});
  const p4 = await b.newPage(); p4.setDefaultTimeout(30000);
  await p4.goto(`${BASE}/forgot`);
  step("재설정 화면 접근", (await p4.locator("body").innerText()).includes("비밀번호 재설정"));
  await p4.close();

  // ── 활동을 하나 만든 뒤 탈퇴 → 자료가 사라진다 ──────────────
  await p2.goto(`${BASE}/activities/new`);
  await p2.getByLabel("활동명 *").fill("탈퇴 테스트 활동");
  await p2.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await p2.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  step("탈퇴 전 활동 생성", true);

  await p2.goto(`${BASE}/settings`);
  await p2.getByRole("button", { name: "계정 삭제하기" }).click();
  await p2.getByLabel(/확인을 위해/).fill("wrong@test.local");
  step("이메일이 다르면 삭제 버튼 비활성", await p2.getByRole("button", { name: "영구 삭제" }).isDisabled());
  await p2.getByLabel(/확인을 위해/).fill(email);
  await p2.getByRole("button", { name: "영구 삭제" }).click();
  await p2.waitForURL(/\/login/, { timeout: 30000 });
  step("탈퇴 후 로그인 화면으로", true);

  // 지운 계정으로는 로그인되지 않는다
  await p2.getByLabel("이메일").fill(email);
  await p2.getByLabel("비밀번호").fill("secondpass123!");
  await p2.getByRole("button", { name: "로그인" }).click();
  await p2.waitForTimeout(1200);
  step("삭제된 계정으로 로그인 불가", new URL(p2.url()).pathname === "/login");
  await p2.close();
} catch (e) {
  step("예외", false, String(e).slice(0, 200));
} finally {
  await b.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
}
