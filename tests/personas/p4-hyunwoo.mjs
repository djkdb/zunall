/**
 * 페르소나 4 — 최현우 (산업디자인과 4학년, UX 디자이너 희망, 거의 폰으로만 씀)
 *
 * 상황: 졸업전시와 공모전을 같이 한다. 공고는 인스타·카톡 링크로 받는다.
 *       노트북은 작업용이고 이런 앱은 폰으로 본다.
 * 알고 싶은 것: "링크 하나 던지면 알아서 정리되나? 포트폴리오 링크로 보낼 수 있나?"
 * 확인할 것: 모바일 전체 흐름(가로 넘침, 터치), "UX 디자이너"가 맞는 직무로
 *           잡히는가, 링크 붙여넣기로 등록, 포트폴리오 공유.
 */
import { startPersona, signup, onboard, BASE } from "./kit.mjs";

const SITE = process.env.SITE ?? "http://127.0.0.1:8795";
const persona = {
  id: "p4-hyunwoo",
  name: "최현우",
  profile: "산업디자인과 4학년 · UX 디자이너 희망 · 폰으로만 사용",
  job: "링크만 던져서 공고 정리, 포트폴리오를 링크로 공유",
};
const { page, see, act, finish } = await startPersona(persona, { mobile: true });

await act("소개 화면(모바일)", () => page.goto(`${BASE}/welcome`));
await see("소개 화면(모바일)");

await act("가입", () => signup(page, persona));
await see("가입 직후(모바일)");

await act("온보딩", () =>
  onboard(page, {
    field: "예술·체육",
    major: "산업디자인과",
    goal: "UX 디자이너",
    companies: "토스, 당근",
    skills: ["디자인"],
  }),
);
await see("온보딩 직후 커리어(모바일)", "UX 디자이너가 맞는 직무로 잡혔나");

await act("링크로 활동 등록", async () => {
  await page.goto(`${BASE}/activities/new`);
  await page.getByLabel("공고 주소").fill(`${SITE}/notice`);
  await page.getByRole("button", { name: /자동으로 활동 만들기/ }).click();
  await page.waitForURL(/\/activities\/[a-z0-9]{20}$/, { timeout: 60000 });
});
await see("링크로 만든 활동(모바일)", "폰 화면에서 탭이 다 보이나");

await act("활동 상세 탭 스크롤", async () => {
  // 탭이 많다. 폰에서 '할 일' 탭까지 갈 수 있나
  await page.getByRole("link", { name: "할 일" }).first().click();
  await page.waitForTimeout(1200);
});
await see("할 일 탭(모바일)");

await act("대시보드(모바일)", () => page.goto(`${BASE}/`));
await see("대시보드(모바일)", "사이드바가 화면을 얼마나 먹나");

await act("포트폴리오(모바일)", () => page.goto(`${BASE}/portfolio`));
await see("포트폴리오(모바일)");

await act("포트폴리오 공유 링크 만들기", async () => {
  await page.getByRole("button", { name: /공유 링크|링크 만들기|공유하기/ }).first().click();
  await page.waitForTimeout(1500);
});
await see("공유 링크 생성 후(모바일)", "링크를 복사해 카톡으로 보낼 수 있나");

await act("설정(모바일)", () => page.goto(`${BASE}/settings`));
await see("설정(모바일)");

await finish();
