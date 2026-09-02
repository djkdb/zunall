/** 자기소개서 문항별 코칭 E2E. 실행: node tests/e2e-essay.mjs */
import { launchBrowser } from "./browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const weak = `저는 팀 프로젝트에 참여하며 최선을 다했습니다. 우리는 서비스를 만들었고 많은 것을 배웠습니다. 앞으로도 노력하겠습니다.`;
const strong = `저는 4인 팀에서 백엔드를 맡아 결제 API를 설계했습니다. 응답 지연이 잦다는 사용자 리포트를 확인하고 쿼리 구조를 바꿔 평균 응답을 820ms에서 210ms로 줄였습니다. 그 결과 결제 이탈률이 12%에서 5%로 떨어졌고, 재구매율은 3주 만에 18% 올랐습니다. 이 과정에서 성능 문제는 감이 아니라 측정으로 접근해야 한다는 기준을 세웠습니다.`;

const b = await launchBrowser();
const p = await b.newPage(); p.setDefaultTimeout(30000);
try {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill("자소서");
  await p.getByLabel("이메일").fill(`essay-${Date.now()}@test.local`);
  await p.getByLabel("비밀번호").fill("essaypass123!");
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);

  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill("자소서 테스트 인턴");
  await p.getByRole("button", { name: "활동 만들기" }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  const url = p.url();

  await p.goto(`${url}?tab=essay`);
  step("자소서 탭 진입", (await p.locator("main").innerText()).includes("문항"));

  await p.getByRole("button", { name: "문항 추가" }).click();
  await p.getByLabel("문항 *").fill("지원 동기와 입사 후 목표를 기술해주세요.");
  await p.getByLabel("글자수 제한").fill("300");
  await p.getByRole("button", { name: "추가", exact: true }).click();
  await p.waitForTimeout(1500);
  step("문항 등록", (await p.locator("main").innerText()).includes("지원 동기와 입사 후 목표"));

  // 부실한 초안 → 첨삭
  await p.locator("textarea").first().fill(weak);
  const counter = await p.locator("main").innerText();
  step("글자수 카운터 표시", /공백 제외 \d+자 \/ 300자/.test(counter), counter.match(/공백 제외 \d+자 \/ 300자/)?.[0]);

  await p.getByRole("button", { name: /저장하고 AI 첨삭/ }).click();
  await p.waitForSelector("text=고칠 점", { timeout: 60000 });
  let text = await p.locator("main").innerText();
  const weakScore = Number(text.match(/(\d+)점/)?.[1] ?? 0);
  step("첨삭 결과 표시 (점수·총평)", weakScore > 0, `${weakScore}점`);
  step("수치 부재를 지적", text.includes("수치로"), text.match(/성과가[^\n]*/)?.[0]?.slice(0, 40));
  step("상투적 표현 고쳐쓰기 제안", text.includes("문장 고쳐쓰기") && text.includes("최선을 다했습니다"));

  // 개선한 초안 → 점수 상승
  await p.locator("textarea").first().fill(strong);
  await p.getByRole("button", { name: /저장하고 AI 첨삭/ }).click();
  await p.waitForTimeout(3500);
  text = await p.locator("main").innerText();
  const strongScore = Number(text.match(/(\d+)점/)?.[1] ?? 0);
  step("개선 후 점수 상승", strongScore > weakScore, `${weakScore} → ${strongScore}`);
  step("이전 버전과 점수 변화 표시", text.includes("이전") && /\+\d+/.test(text));
  step("이전 버전 목록 보관", text.includes("이전 버전"));

  // 문항 요구 반영 여부
  step("수치 성과를 강점으로 인식", text.includes("수치로 제시"), "");
} catch (e) {
  step(`예외: ${String(e).split("\n")[0].slice(0, 130)}`, false);
} finally {
  await b.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
