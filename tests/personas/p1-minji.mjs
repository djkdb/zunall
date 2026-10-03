/**
 * 페르소나 1 — 김민지 (경영학과 3학년, 마케터 희망, 대외활동을 많이 하는 학생)
 *
 * 상황: 서포터즈 2개를 하면서 공모전 2개 마감이 3일·5일 뒤로 겹쳤다.
 * 알고 싶은 것: "이번 주에 뭐부터 하지? 하나는 포기해야 하나?"
 * 확인할 것: 자유 입력 목표("뷰티 브랜드 마케터")가 마케터로 잡히는가,
 *           대시보드가 급한 순서를 알려주는가, 마감이 몰렸을 때 말려주는가.
 */
import { startPersona, signup, onboard, addActivity, inDays, BASE } from "./kit.mjs";

const persona = {
  id: "p1-minji",
  name: "김민지",
  profile: "경영학과 3학년 · 마케터 희망 · 대외활동 4개 동시 진행",
  job: "이번 주에 무엇부터 할지, 무엇을 포기할지",
};
const { page, see, act, finish } = await startPersona(persona);

await act("가입", () => signup(page, persona));
await see("가입 직후 대시보드", "아무것도 없는 첫 화면");

await act("온보딩", () =>
  onboard(page, {
    field: "상경·경영",
    major: "경영학과",
    goal: "뷰티 브랜드 마케터",
    companies: "아모레퍼시픽, 올리브영",
    headline: "트렌드를 숫자로 읽는 마케터",
    skills: ["마케팅", "콘텐츠 제작", "데이터 분석"],
  }),
);
await see("온보딩 직후 커리어", "목표가 '마케터'로 잡혔나");

const acts = [
  { name: "올리브영 대학생 서포터즈 8기", organizer: "CJ올리브영", type: "supporters", status: "active" },
  { name: "아모레퍼시픽 뷰티 앰배서더", organizer: "아모레퍼시픽", type: "external", status: "active" },
  { name: "2026 대학생 광고 마케팅 공모전", organizer: "한국광고학회", type: "contest", status: "planned", applyDeadline: inDays(3) },
  { name: "제12회 소셜 콘텐츠 공모전", organizer: "한국콘텐츠진흥원", type: "contest", status: "planned", applyDeadline: inDays(5) },
];
const urls = [];
for (const a of acts) urls.push(await act(`활동 등록: ${a.name}`, () => addActivity(page, a)));

await act("대시보드", () => page.goto(`${BASE}/`));
await see("활동 4개 등록 후 대시보드", "이번 주에 뭐부터 하라고 하나");

await act("캘린더", () => page.goto(`${BASE}/calendar`));
await see("캘린더", "마감 겹침이 보이나");

await act("활동 목록", () => page.goto(`${BASE}/activities`));
await see("활동 목록");

// 마감 3일 남은 공모전의 적합도를 본다 — 말려주는가?
if (urls[2]) {
  await act("공모전 적합도 탭", () => page.goto(`${urls[2]}?tab=fit`));
  await see("적합도 탭(분석 전)");
  await act("적합도 분석 실행", async () => {
    await page.getByRole("button", { name: "지원 적합도 분석" }).first().click();
    await page.waitForTimeout(6000);
  });
  await see("적합도 분석 결과", "3일 남은 공모전, 서포터즈 2개 진행 중");
}

await act("기회 찾기", () => page.goto(`${BASE}/opportunities`));
await see("기회 찾기");

await act("알림", () => page.goto(`${BASE}/notifications`));
await see("알림", "마감 임박 알림이 왔나");

await finish();
