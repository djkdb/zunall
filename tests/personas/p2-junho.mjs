/**
 * 페르소나 2 — 이준호 (컴퓨터공학과 4학년, 백엔드 개발자 취업 준비)
 *
 * 상황: 하반기 공채 시즌. 회사 3곳 자소서를 동시에 쓰는데 문항이 비슷하다.
 * 알고 싶은 것: "예전에 쓴 답변을 다시 쓸 수 있나? 면접은 뭘 물어볼까?
 *              내가 부족한 게 뭐지?"
 * 확인할 것: "네카라쿠배 백엔드"처럼 회사 은어가 섞인 목표를 알아듣는가,
 *           자소서 문항 은행이 비슷한 문항을 묶어주는가, 면접 준비, 포트폴리오 공유.
 */
import { startPersona, signup, onboard, addActivity, inDays, BASE } from "./kit.mjs";

const persona = {
  id: "p2-junho",
  name: "이준호",
  profile: "컴퓨터공학과 4학년 · 백엔드 개발자 취준 · 프로젝트 3개",
  job: "자소서 재사용, 면접 준비, 부족한 역량 파악",
};
const { page, see, act, finish } = await startPersona(persona);

await act("가입", () => signup(page, persona));
await act("온보딩", () =>
  onboard(page, {
    field: "공학·IT",
    major: "컴퓨터공학과",
    goal: "네카라쿠배 백엔드 개발자",
    companies: "네이버, 카카오, 쿠팡",
    headline: "트래픽을 견디는 서버를 만드는 개발자",
    github: "junho-dev",
    skills: ["Backend", "프로그래밍", "Cloud / 배포"],
  }),
);
await see("온보딩 직후 커리어", "'네카라쿠배 백엔드'가 백엔드로 잡혔나");

// 경험(근거) 추가
await act("경험 추가 화면", () => page.goto(`${BASE}/career`));
await act("경험 1건 추가", async () => {
  await page.getByRole("button", { name: "근거 추가" }).click();
  await page.getByLabel("제목 *").fill("대학 수강신청 트래픽 분산 프로젝트");
  await page.getByLabel(/이 근거가 증명하는 스킬/).fill("Backend, Cloud / 배포, 시스템 설계");
  await page.getByLabel("설명").fill("Spring Boot + Redis 로 동시 접속 3천 명 처리, 응답 시간 70% 단축");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page.waitForTimeout(1500);
});
await see("경험 추가 후 커리어", "점수·부족한 부분이 바뀌었나");

await act("부족한 부분", () => page.goto(`${BASE}/career/gaps`));
await see("부족한 부분", "백엔드 개발자에게 맞는 조언인가");

// 회사 3곳 지원
const companies = [
  { name: "네이버 2026 하반기 신입 백엔드", organizer: "네이버", type: "recruit", status: "planned", applyDeadline: inDays(6) },
  { name: "카카오 2026 하반기 서버 개발 신입", organizer: "카카오", type: "recruit", status: "planned", applyDeadline: inDays(9) },
  { name: "쿠팡 Backend Engineer 신입", organizer: "쿠팡", type: "recruit", status: "planned", applyDeadline: inDays(12) },
];
const urls = [];
for (const c of companies) urls.push(await act(`지원 등록: ${c.organizer}`, () => addActivity(page, c)));

// 자소서: 회사마다 비슷한 문항
const questions = [
  "지원 동기와 입사 후 포부를 작성해주세요.",
  "우리 회사에 지원한 이유와 입사 후 이루고 싶은 목표를 서술해주세요.",
  "가장 어려웠던 기술적 문제와 이를 해결한 과정을 작성해주세요.",
];
for (let i = 0; i < urls.length; i++) {
  if (!urls[i]) continue;
  await act(`자소서 문항: ${companies[i].organizer}`, async () => {
    await page.goto(`${urls[i]}?tab=essay`);
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "문항 추가" }).click();
    await page.getByLabel("문항 *").fill(questions[i]);
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await page.waitForTimeout(1200);
    // 첫 회사에는 실제로 답변까지 써 둔다 — 다음 회사에서 다시 쓸 수 있는지 보려고
    if (i === 0) {
      await page.getByRole("textbox", { name: /답변/ }).first().fill(
        "대규모 트래픽을 다루는 서비스에서 안정성을 책임지는 개발자가 되고 싶어 지원했습니다. 수강신청 서버를 Redis 로 분산해 응답 시간을 70% 줄인 경험이 있습니다. 입사 후에는 장애 없는 결제 시스템을 만드는 데 기여하고 싶습니다.",
      );
      await page.getByRole("button", { name: "저장만" }).click();
      await page.waitForTimeout(1200);
    }
  });
}
if (urls[1]) {
  await act("두 번째 회사 자소서 탭", () => page.goto(`${urls[1]}?tab=essay`));
  await see("두 번째 회사 자소서", "앞서 쓴 비슷한 문항을 알려주나");
}

await act("자소서 문항 은행", () => page.goto(`${BASE}/essays`));
await see("자소서 문항 은행", "지원 동기 문항 2개가 같은 유형으로 묶였나");

if (urls[0]) {
  await act("면접 탭", () => page.goto(`${urls[0]}?tab=interview`));
  await see("면접 탭(생성 전)");
  await act("면접 질문 만들기", async () => {
    await page.getByRole("button", { name: "예상 질문 만들기" }).click();
    await page.waitForTimeout(6000);
  });
  await see("면접 질문", "백엔드 직무에 맞는 질문인가");
}

await act("포트폴리오", () => page.goto(`${BASE}/portfolio`));
await see("포트폴리오", "링크 하나로 보낼 수 있나");

await finish();
