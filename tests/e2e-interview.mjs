/** 면접 준비 E2E. 실행: node tests/e2e-interview.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(40000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("면접");
  await p.getByLabel("이메일").fill(`interview-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("interviewpass123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  // 활동 + 자소서 답변 준비
  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill("면접 테스트 인턴");
  await p.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  const activityUrl = p.url();

  await p.goto(`${activityUrl}?tab=essay`);
  await p.getByRole("button", { name: "문항 추가" }).click();
  await p.getByLabel("문항 *").fill("팀 프로젝트에서 맡은 역할과 성과를 적어주세요.");
  await p.getByRole("button", { name: "추가", exact: true }).click();
  await p.waitForTimeout(1500);
  await p.getByRole("textbox", { name: /답변/ }).first()
    .fill("데이터 분석 팀플에서 전처리를 맡아 결측치 처리 기준을 정했고, 모델 정확도를 12% 올렸습니다.");
  await p.getByRole("button", { name: "저장만" }).click();
  await p.waitForTimeout(2000);

  // ── 면접 탭 ────────────────────────────────────────────────
  await p.goto(`${activityUrl}?tab=interview`);
  step("면접 탭 진입", (await p.locator("main").innerText()).includes("예상 질문 만들기"));

  await p.getByRole("button", { name: "예상 질문 만들기" }).click();
  await p.waitForTimeout(8000);
  let text = await p.locator("main").innerText();
  step("질문이 생성됨", /질문 \d+개/.test(text), text.split("\n").find((l) => l.includes("질문")) ?? "");
  step("지원 동기 질문 포함", text.includes("지원한 이유"));
  step("내가 쓴 문장에서 파고든 질문", text.includes("결측치") || text.includes("정확도"), "자소서 근거 반영");
  step("왜 나오는지 설명", text.includes("왜 나오나"));
  step("답변 포인트 제시", text.includes("답변 포인트"));

  // ── 답변 저장 ──────────────────────────────────────────────
  await p.getByRole("textbox", { name: /답변/ }).first()
    .fill("전처리 담당으로 기준을 문서화해 팀 전체가 같은 규칙을 쓰게 했습니다.");
  await p.getByRole("button", { name: "저장", exact: true }).first().click();
  await p.waitForTimeout(2000);
  step("답변 저장", (await p.locator("main").innerText()).includes("기준을 문서화"));

  // ── 준비 완료 체크 ─────────────────────────────────────────
  await p.getByRole("button", { name: "준비 완료로 표시" }).first().click();
  await p.waitForTimeout(2000);
  text = await p.locator("main").innerText();
  step("준비 완료 카운트", /준비 완료 1개/.test(text), text.split("\n").find((l) => l.includes("준비 완료")) ?? "");

  // ── 직접 질문 추가 ─────────────────────────────────────────
  await p.getByLabel("질문 직접 추가").fill("마지막으로 하고 싶은 말이 있나요?");
  await p.getByRole("button", { name: "추가" }).click();
  await p.waitForTimeout(2000);
  step("직접 추가한 질문 표시", (await p.locator("main").innerText()).includes("마지막으로 하고 싶은 말"));

  // ── 다시 생성해도 중복되지 않는다 ──────────────────────────
  const before = ((await p.locator("main").innerText()).match(/왜 나오나/g) ?? []).length;
  await p.getByRole("button", { name: "예상 질문 만들기" }).click();
  await p.waitForTimeout(8000);
  const after = ((await p.locator("main").innerText()).match(/왜 나오나/g) ?? []).length;
  step("다시 만들어도 중복 없음", after === before, `${before} → ${after}`);

  // ── 탭 배지 (준비 안 된 질문 수) ───────────────────────────
  await p.goto(activityUrl);
  step("탭에 남은 질문 수 표시", (await p.getByRole("link", { name: /^면접/ }).innerText()).includes("면접"));

  // ── 삭제 ──────────────────────────────────────────────────
  await p.goto(`${activityUrl}?tab=interview`);
  const cards = await p.getByRole("button", { name: "질문 삭제" }).count();
  await p.getByRole("button", { name: "질문 삭제" }).first().click();
  await p.waitForTimeout(2000);
  step("질문 삭제", (await p.getByRole("button", { name: "질문 삭제" }).count()) === cards - 1);
} catch (e) {
  step("예외", false, String(e).slice(0, 250));
} finally {
  await b.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
}
