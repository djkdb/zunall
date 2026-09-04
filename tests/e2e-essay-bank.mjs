/** 자소서 문항 은행 + 과거 답변 재사용 E2E. 실행: node tests/e2e-essay-bank.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(30000);

/** 활동 하나를 만들고 자소서 탭으로 이동 */
async function newActivityEssayTab(name) {
  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill(name);
  await p.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  const url = p.url();
  await p.goto(`${url}?tab=essay`);
  return url;
}

async function addQuestion(text) {
  await p.getByRole("button", { name: "문항 추가" }).click();
  await p.getByLabel("문항 *").fill(text);
  await p.getByRole("button", { name: "추가", exact: true }).click();
  await p.waitForTimeout(1500);
}

try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("자소서");
  await p.getByLabel("이메일").fill(`essay-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("essaypass123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  // ── 첫 지원서: 협업 문항에 답변 저장 ────────────────────────
  await newActivityEssayTab("A 공모전");
  await addQuestion("팀 프로젝트에서 갈등을 해결한 경험을 서술해주세요.");
  const answer = "학과 팀플에서 역할 분담 갈등이 있었고, 기준을 정해 조율했습니다. 그 결과 마감 전에 제출했습니다.";
  await p.getByRole("textbox", { name: /답변/ }).first().fill(answer);
  await p.getByRole("button", { name: "저장만" }).click();
  await p.waitForTimeout(2000);
  step("답변 저장", (await p.locator("main").innerText()).includes("v1"));

  // ── 문항 은행 ──────────────────────────────────────────────
  await p.goto(`${BASE}/essays`);
  let text = await p.locator("main").innerText();
  step("은행에 문항이 모임", text.includes("갈등을 해결한 경험"));
  step("유형이 자동 분류됨", text.includes("협업 · 갈등"), text.split("\n").find((l) => l.includes("협업")) ?? "");
  step("답변 미리보기", text.includes("역할 분담 갈등"));

  // ── 두 번째 지원서: 같은 유형 문항 → 과거 답변 제안 ─────────
  await newActivityEssayTab("B 인턴");
  await addQuestion("협업 과정에서 의견 차이를 조율한 사례를 적어주세요.");

  await p.getByRole("button", { name: /비슷한 문항에 쓴 답변/ }).click();
  await p.waitForTimeout(2000);
  text = await p.locator("main").innerText();
  step("과거 답변을 찾아줌", text.includes("역할 분담 갈등"), text.split("\n").find((l) => l.includes("A 공모전")) ?? "");
  step("어느 지원서였는지 표시", text.includes("A 공모전"));

  await p.getByRole("button", { name: "가져오기" }).first().click();
  await p.waitForTimeout(500);
  const box = await p.getByRole("textbox", { name: /답변/ }).first().inputValue();
  step("가져오면 편집란에 들어감", box.includes("역할 분담 갈등"), `${box.length}자`);

  // ── 다른 유형 문항에는 제안하지 않는다 ──────────────────────
  await addQuestion("입사 후 이루고 싶은 포부를 적어주세요.");
  const panels = p.getByRole("button", { name: /비슷한 문항에 쓴 답변/ });
  await panels.last().click();
  await p.waitForTimeout(2000);
  const lastCard = await p.locator("main").innerText();
  step(
    "유형이 다르면 제안하지 않음",
    lastCard.includes("같은 유형으로 저장해둔 답변이 아직 없습니다"),
  );

  // ── 유형 필터 ──────────────────────────────────────────────
  await p.goto(`${BASE}/essays`);
  step("유형 필터 노출", (await p.locator("main").innerText()).includes("협업 · 갈등 2"));
  await p.getByRole("link", { name: /입사 후 포부/ }).click();
  await p.waitForTimeout(1200);
  text = await p.locator("main").innerText();
  step("필터가 걸림", text.includes("포부") && !text.includes("갈등을 해결한 경험"));
} catch (e) {
  step("예외", false, String(e).slice(0, 250));
} finally {
  await b.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
}
