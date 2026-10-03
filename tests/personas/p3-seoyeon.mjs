/**
 * 페르소나 3 — 박서연 (국어국문학과 2학년, 진로 미정, 대외활동 경험 없음)
 *
 * 상황: 주변이 다 뭔가를 하고 있어 불안하다. 출판·콘텐츠 쪽이 막연히 좋지만
 *       확신은 없다. 해 본 활동이 하나도 없다.
 * 알고 싶은 것: "나 같은 사람은 뭐부터 해야 해?"
 * 확인할 것: 이 서비스의 약속("무엇을 해야 하는지 알려준다")이 가장 필요한
 *           사람이다. 빈손으로 와도 첫 걸음을 받는가, 인문계에 맞는 조언인가,
 *           목표를 "잘 모르겠음"으로 적어도 진행되는가.
 */
import { startPersona, signup, onboard, BASE } from "./kit.mjs";

const persona = {
  id: "p3-seoyeon",
  name: "박서연",
  profile: "국어국문학과 2학년 · 진로 미정(출판·콘텐츠에 막연한 관심) · 활동 경험 0",
  job: "나 같은 사람은 뭐부터 해야 하는지",
};
const { page, see, act, finish } = await startPersona(persona);

await act("소개 화면", () => page.goto(`${BASE}/welcome`));
await see("소개 화면", "가입 전에 무엇을 해주는 서비스인지 알 수 있나");

await act("가입", () => signup(page, persona));
await see("가입 직후 대시보드", "빈손으로 왔을 때 첫 화면");

await act("커리어 첫 화면", () => page.goto(`${BASE}/career`));
await see("온보딩 시작 화면", "진로가 없어도 시작할 수 있어 보이나");

await act("온보딩(진로 미정)", () =>
  onboard(page, {
    field: "인문·어학",
    major: "국어국문학과",
    goal: "아직 잘 모르겠어요. 출판이나 콘텐츠 쪽?",
    skills: ["글쓰기"],
  }),
);
await see("온보딩 직후 커리어", "진로 미정인데 어떤 직무 기준으로 판단하나");

await act("대시보드", () => page.goto(`${BASE}/`));
await see("온보딩 후 대시보드", "오늘의 한 걸음이 나 같은 사람에게 말이 되나");

await act("부족한 부분", () => page.goto(`${BASE}/career/gaps`));
await see("부족한 부분", "인문계 2학년에게 맞는 조언인가");

await act("활동 화면", () => page.goto(`${BASE}/activities`));
await see("활동 목록(빈 상태)", "무엇을 등록하라고 안내하나");

await act("새 활동 화면", () => page.goto(`${BASE}/activities/new`));
await see("새 활동 화면", "인문계에 맞는 활동 예시가 보이나");

await act("기회 찾기", () => page.goto(`${BASE}/opportunities`));
await see("기회 찾기", "공고를 어디서 찾으라는지 알려주나");

await act("가이드", () => page.goto(`${BASE}/guide`));
await see("가이드");

await act("성장 기록", () => page.goto(`${BASE}/career`));
await see("커리어(재방문)", "점수가 낮을 때 기분이 어떤가");

// 첫 실험을 해 본 뒤 마음이 가는 쪽을 고른다
await act("후보 중 하나로 정하기", async () => {
  await page.goto(`${BASE}/`);
  const card = page.locator("li", { hasText: "언론 / 미디어 / PR" }).first();
  await card.getByRole("button", { name: "이 직무로 정하기" }).click();
  await page.getByText("목표 준비도").first().waitFor({ timeout: 15000 });
});
await see("직무를 정한 뒤 대시보드", "정하고 나면 그때부터 준비도를 보여주나");

await finish();
