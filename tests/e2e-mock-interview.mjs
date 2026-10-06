/**
 * 모의 면접 E2E (zunterview 이식). 실행: node tests/e2e-mock-interview.mjs
 *
 * 설정 → 면접실(질문·답변·꼬리질문) → 리포트 → 다시 답해 보기 → 면접 준비에 담기 → 기록,
 * 그리고 다른 사람의 면접은 열 수 없는지까지.
 */
import { launchBrowser, describePage } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const results = [];
const step = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`);
};
const consoleErrors = [];

async function signup(p, name) {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill(name);
  await p.getByLabel("이메일").fill(`mi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`);
  await p.getByLabel("비밀번호").fill("mockinterview123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);
}

const GOOD =
  "지난 학기 교내 카페 SNS 운영을 맡아 인스타그램 팔로워를 3개월 동안 1,200명에서 2,000명으로 늘렸습니다. 지난 게시물 40개의 저장 수를 정리해 보니 이용 팁 게시물이 메뉴 사진보다 저장이 두 배 많아 주 2회 팁 콘텐츠로 바꿨고, 월 방문 고객이 15% 늘었습니다.";

async function answerUntilDone(p, max = 14) {
  let answered = 0;
  for (; answered < max; answered++) {
    const done = await Promise.race([
      p.getByTestId("mi-overall").waitFor({ timeout: 30000 }).then(() => true),
      p.locator("#mi-answer:not([disabled])").waitFor({ timeout: 30000 }).then(() => false),
    ]);
    if (done) break;
    await p.locator("#mi-answer").fill(GOOD);
    await p.getByRole("button", { name: "답변 제출" }).click();
    await p.waitForTimeout(300);
  }
  return answered;
}

const b = await launchBrowser();
let p;
try {
  p = await b.newPage();
  p.setDefaultTimeout(30000);
  p.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  await signup(p, "면접연습");

  // 활동 + 자소서 (서류 기반 면접용)
  await p.goto(`${BASE}/activities/new`);
  await p.getByLabel("활동명 *").fill("카카오 마케팅 인턴");
  await p.getByLabel("활동 종류").selectOption("intern");
  await p.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await p.waitForURL(/\/activities\/[a-z0-9]{20}$/);
  const activityUrl = p.url();
  const activityId = activityUrl.split("/").pop();
  await p.goto(`${activityUrl}?tab=essay`);
  await p.getByRole("button", { name: "문항 추가" }).click();
  await p.getByLabel("문항 *").fill("가장 큰 성과를 낸 경험을 적어주세요.");
  await p.getByRole("button", { name: "추가", exact: true }).click();
  await p.waitForTimeout(1500);
  await p.getByRole("textbox", { name: /답변/ }).first().fill("교내 카페 SNS 운영을 맡아 팔로워를 3개월 만에 60% 늘렸습니다. 게시물 40개의 저장 수를 분석해 콘텐츠를 바꿨습니다.");
  await p.getByRole("button", { name: "저장만" }).click();
  await p.waitForTimeout(2000);

  // 사흘 뒤 면접 일정 → 대시보드·모의 면접 첫 화면이 연습을 권한다
  const inDays = (n) => {
    const d = new Date(Date.now() + n * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  await p.goto(`${activityUrl}?tab=calendar`);
  await p.getByRole("button", { name: "일정 추가" }).click();
  await p.locator("#ev-title").fill("1차 면접");
  await p.locator("#ev-type").selectOption("interview");
  await p.locator("#ev-date").fill(inDays(3));
  await p.locator("#ev-title").press("Enter");
  await p.getByText("1차 면접").first().waitFor();
  await p.goto(`${BASE}/`);
  let main = await p.locator("main").innerText();
  step("대시보드: 일주일 안 면접이면 모의 면접 권유", main.includes("면접 D-3") && main.includes("카카오 마케팅 인턴"));
  await p.goto(`${BASE}/interview`);
  step("모의 면접 첫 화면: 다가오는 면접", (await p.locator("main").innerText()).includes("다가오는 면접"));

  // ── 메뉴·활동 면접 탭에서 들어가기 ─────────────────────────
  await p.goto(`${BASE}/`);
  step("메뉴에 모의 면접", await p.getByRole("link", { name: "모의 면접" }).first().isVisible());
  await p.goto(`${activityUrl}?tab=interview`);
  step("활동 면접 탭에 '이 공고로 모의 면접'", (await p.locator("main").innerText()).includes("이 공고로 모의 면접"));
  await p.locator("main").getByRole("link", { name: "모의 면접 보기" }).click();
  await p.waitForURL(/\/interview\/new\?activity=/);
  main = await p.locator("main").innerText();
  step("활동이 연결된 채로 설정 화면", (await p.locator("#mi-activity").inputValue()) === activityId);
  step("활동 이름에서 기업(카카오)을 찾아 둠", (await p.locator("#mi-company").inputValue()) === "kakao");
  step("자소서로 질문받기 옵션", main.includes("이 활동에 쓴 자기소개서로 질문받기"));

  // 직무 검색
  await p.locator("#mi-role").fill("브랜드");
  await p.getByRole("option", { name: /브랜드 마케팅/ }).first().click();
  step("직무 검색·선택", (await p.getByTestId("mi-selected-role").innerText()).includes("브랜드 마케팅"));
  await p.getByRole("radio", { name: /^3개/ }).click();
  await p.getByRole("button", { name: "면접 시작" }).click();
  await p.waitForURL(/\/interview\/[a-z0-9]{20}$/);
  const interviewUrl = p.url();

  // ── 면접실 ─────────────────────────────────────────────────
  await p.getByTestId("mi-question").waitFor();
  main = await p.locator("main").innerText();
  step("면접관 3명 패널", (await p.locator('svg[aria-label^="면접관 3명"]').count()) === 1);
  step("인사 후 첫 질문", main.includes("면접을 시작하겠습니다") && main.includes("질문 1 / 3"));
  step("서류를 읽었다고 말함 (서류 기반)", main.includes("서류"));
  step("면접 중에는 점수를 보여주지 않음", !/\d+점/.test(main));

  // 질문을 이해 못 했다고 하면 다시 설명
  const firstQ = await p.getByTestId("mi-question").innerText();
  await p.locator("#mi-answer:not([disabled])").waitFor();
  await p.locator("#mi-answer").fill("질문이 잘 이해가 안 돼요");
  await p.getByRole("button", { name: "답변 제출" }).click();
  await p.locator("#mi-answer:not([disabled])").waitFor();
  main = await p.locator("main").innerText();
  step("질문 설명 요청 → 설명 후 같은 질문", main.includes("설명드리겠습니다") && (await p.getByTestId("mi-question").innerText()) === firstQ);

  // 첫 답변 후 다음 질문 (꼬리질문일 수 있음)
  await p.locator("#mi-answer").fill(GOOD);
  await p.getByRole("button", { name: "답변 제출" }).click();
  await p.locator("#mi-answer:not([disabled])").waitFor();
  const secondQ = await p.getByTestId("mi-question").innerText();
  step("답하면 다음 질문", secondQ !== firstQ, secondQ);

  // 새로고침해도 이어서
  await p.reload();
  await p.getByTestId("mi-question").waitFor();
  step("새로고침해도 같은 질문에서 이어짐", (await p.getByTestId("mi-question").innerText()) === secondQ);
  step("지금까지 한 문답이 남음", (await p.locator("main").innerText()).includes("지금까지 한 문답 1개"));

  const answered = await answerUntilDone(p);
  await p.getByTestId("mi-overall").waitFor();
  main = await p.locator("main").innerText();
  step("끝까지 답하면 리포트", main.includes("항목별 점수") && main.includes("문답별 피드백"), `추가 답변 ${answered}개`);
  step("6개 항목 점수", ["질문 이해도", "논리성", "구체성", "답변 구조", "전달력", "자신감"].every((k) => main.includes(k)));
  step("가장 먼저 고칠 것", main.includes("가장 먼저 고칠 것"));
  step("STAR 표시", main.includes("상황") && main.includes("결과"));
  step("고쳐 말하기 예시", main.includes("이렇게 바꿔 말해 보기"));
  step("서류와 답변 비교", main.includes("서류와 답변 비교"));
  step("연결된 활동 표시", main.includes("카카오 마케팅 인턴"));

  // 다시 답해 보기
  await p.getByRole("button", { name: "다시 답해 보기" }).first().click();
  await p.locator('textarea[id^="re-"]').first().fill(GOOD + " 그 과정에서 제가 직접 저장 수 표를 만들어 팀원들과 매주 공유했습니다.");
  await p.getByRole("button", { name: "다시 채점받기" }).click();
  await p.getByText(/다시 답한 결과 \d+점/).first().waitFor();
  step("다시 답한 점수가 원래 점수 옆에 남음", true);

  // 면접 준비에 담기
  await p.getByRole("button", { name: "면접 준비에 담기" }).first().click();
  await p.getByText("면접 준비에 담았습니다").first().waitFor();
  await p.goto(`${activityUrl}?tab=interview`);
  main = await p.locator("main").innerText();
  step("담은 질문이 활동 면접 준비에 있음", main.includes("질문 1개") || /질문 \d+개/.test(main));
  step("활동 면접 탭에 이번 모의 면접 기록", /\d+점 [SABCD]/.test(main));

  // 기록
  await p.goto(`${BASE}/interview`);
  main = await p.locator("main").innerText();
  step("면접 기록 목록", main.includes("면접 기록") && main.includes("브랜드 마케팅"));
  step("자주 약한 항목", main.includes("자주 약한 항목"));

  // 같은 설정으로 다시 보기
  await p.goto(interviewUrl);
  await p.getByRole("link", { name: "같은 설정으로 다시 보기" }).click();
  await p.waitForURL(/\/interview\/new\?from=/);
  step("같은 설정이 채워짐", (await p.getByTestId("mi-selected-role").innerText()).includes("브랜드 마케팅") && (await p.locator("#mi-company").inputValue()) === "kakao");

  // 중간에 끝내기
  await p.getByRole("button", { name: "면접 시작" }).click();
  await p.waitForURL(/\/interview\/[a-z0-9]{20}$/);
  await p.locator("#mi-answer:not([disabled])").waitFor();
  await p.locator("#mi-answer").fill(GOOD);
  await p.getByRole("button", { name: "답변 제출" }).click();
  await p.locator("#mi-answer:not([disabled])").waitFor();
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "면접 끝내기" }).click();
  await p.getByTestId("mi-overall").waitFor();
  step("중간에 끝내도 답한 만큼 리포트", (await p.locator("main").innerText()).includes("중간에 끝냄"));

  // 기업별 질문
  await p.goto(`${BASE}/interview/companies`);
  await p.locator('a[href="/interview/companies/kakao"]').click();
  await p.waitForURL(/\/interview\/companies\/kakao$/);
  await p.getByText(/자주 나온 질문 \d+개/).waitFor();
  main = await p.locator("main").innerText();
  step("기업 페이지: 인재상·전형·질문", main.includes("인재상") && main.includes("알려진 전형") && /자주 나온 질문 \d+개/.test(main));

  // 직무별 질문 (비IT 직무도)
  await p.goto(`${BASE}/interview/roles?q=${encodeURIComponent("간호사")}`);
  await p.locator('a[href="/interview/roles/nurse"]').click();
  await p.waitForURL(/\/interview\/roles\/nurse$/);
  main = await p.locator("main").innerText();
  step("직무 페이지: 보는 역량·꼬리질문 흐름·질문", main.includes("면접관이 보는 역량") && main.includes("꼬리질문은 이렇게") && /연습 질문 \d+개/.test(main));
  step("간호사 질문에 개발 질문이 없음", !/코드|API|서버|프레임워크/.test(main));

  // ── 다른 사람의 면접은 열 수 없다 ─────────────────────────
  const other = await b.newPage();
  other.setDefaultTimeout(30000);
  await signup(other, "남");
  const res = await other.goto(interviewUrl);
  const otherText = await other.locator("body").innerText();
  step("다른 사용자는 남의 면접을 못 봄", res?.status() === 404 || !otherText.includes("문답별 피드백"), `status ${res?.status()}`);
  await other.close();

  step("콘솔 오류 없음", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} catch (error) {
  console.error(`❌ 실패 시점 — ${p ? await describePage(p) : ""}`);
  console.error(error);
  results.push(false);
} finally {
  await b.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 통과`);
process.exit(passed === results.length ? 0 : 1);
