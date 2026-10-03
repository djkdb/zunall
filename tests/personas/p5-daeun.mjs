/**
 * 페르소나 5 — 정다은 (통계학과 졸업유예, 데이터 분석가 희망, 인턴 지원 다수·탈락 다수)
 *
 * 상황: 상반기에 인턴 8곳을 넣었다. 서류 탈락 4, 면접 탈락 1, 결과 대기 2, 준비 중 1.
 *       계속 떨어져서 지쳤다. 뭐가 문제인지 모르겠다.
 * 알고 싶은 것: "어디서 계속 떨어지는 거지? 그래도 나아지고 있긴 한가?"
 * 확인할 것: 지원 현황 보드, 탈락 기록·회고, 지원 결과에서 배우는 화면,
 *           성장 기록이 지친 사람에게 힘이 되는가(혹은 더 우울하게 만드는가).
 */
import { startPersona, signup, onboard, addActivity, inDays, BASE } from "./kit.mjs";

const persona = {
  id: "p5-daeun",
  name: "정다은",
  profile: "통계학과 졸업유예 · 데이터 분석가 희망 · 인턴 8곳 지원, 탈락 5",
  job: "어디서 계속 떨어지는지, 그래도 나아지고 있는지",
};
const { page, see, act, finish } = await startPersona(persona);

await act("가입", () => signup(page, persona));
await act("온보딩", () =>
  onboard(page, {
    field: "자연·생명",
    major: "통계학과",
    goal: "데이터 분석가",
    companies: "쿠팡, 토스, 배민",
    skills: ["데이터 분석", "SQL", "Python"],
  }),
);
await see("온보딩 직후 커리어");

const apps = [
  { name: "쿠팡 데이터 분석 인턴", organizer: "쿠팡", status: "lost" },
  { name: "토스 Data Analyst 인턴", organizer: "토스", status: "lost" },
  { name: "배달의민족 데이터 인턴", organizer: "우아한형제들", status: "lost" },
  { name: "카카오뱅크 데이터 분석 인턴", organizer: "카카오뱅크", status: "lost" },
  { name: "네이버 데이터 사이언스 인턴", organizer: "네이버", status: "lost" },
  { name: "당근 데이터 분석 인턴", organizer: "당근", status: "waiting" },
  { name: "무신사 데이터 인턴", organizer: "무신사", status: "waiting" },
  { name: "LG CNS 데이터 인턴", organizer: "LG CNS", status: "planned", applyDeadline: inDays(8) },
];
const urls = [];
for (const a of apps) urls.push(await act(`지원 등록: ${a.organizer}`, () => addActivity(page, { ...a, type: "intern" })));

await act("지원 현황 보드", () => page.goto(`${BASE}/activities?view=board`));
await see("지원 현황 보드", "8곳이 단계별로 한눈에 보이나");

await act("활동 목록", () => page.goto(`${BASE}/activities`));
await see("활동 목록");

// 탈락한 곳마다 어느 단계였는지 적는다 (서류 4, 면접 1)
const stages = ["서류", "서류", "서류", "서류", "면접"];
for (let i = 0; i < stages.length; i++) {
  if (!urls[i]) continue;
  await act(`탈락 단계 기록: ${apps[i].organizer} → ${stages[i]}`, async () => {
    await page.goto(urls[i]);
    const group = page.getByRole("group", { name: "탈락 단계" });
    await group.getByRole("button", { name: stages[i], exact: true }).click();
    await group.getByRole("button", { name: stages[i], exact: true, pressed: true }).waitFor({ timeout: 10000 });
  });
  if (i === 0) await see("탈락 활동 상세", "탈락 뒤에 무엇을 하라고 하나");
}

await act("통계", () => page.goto(`${BASE}/stats`));
await see("통계", "어디서 떨어지는지 알려주나");

await act("대시보드", () => page.goto(`${BASE}/`));
await see("대시보드", "5번 떨어진 사람에게 첫 화면이 어떤가");

await act("커리어", () => page.goto(`${BASE}/career`));
await see("커리어", "성장 기록이 힘이 되나");

await act("부족한 부분", () => page.goto(`${BASE}/career/gaps`));
await see("부족한 부분", "데이터 분석가에게 맞는 조언인가");

await finish();
