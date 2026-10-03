/**
 * 문과·예체능 페르소나 시뮬레이션 — "IT 말고 다른 전공도 쓸 수 있나?"
 *
 * 실행: PERSONA_OUT=/tmp/nonit node tests/personas/nonit.mjs [p6 p7 ...]
 * 각자 온보딩에서 고를 직무가 있는지, 커리어 분석·오늘의 한 걸음이 말이 되는지,
 * 자기 활동(전시·오디션·자격증 시험·봉사)을 등록할 수 있는지, 작품을 근거로 남길 수 있는지 본다.
 */
import { startPersona, signup, addActivity, inDays, BASE } from "./kit.mjs";

const only = process.argv.slice(2);

const PERSONAS = {
  p6: {
    persona: { id: "p6-yerin", name: "한예린", profile: "서양화과 3 · 작가 지망", job: "공모전·전시 일정 관리, 작품 포트폴리오" },
    field: "예술·체육", major: "서양화과", goal: "전시하는 작가 (회화)",
    activity: { name: "2026 청년작가 회화 공모전", type: "contest", status: "planned", applyDeadline: inDays(12) },
    evidence: { title: "단체전 '경계의 색' 출품 (회화 3점)", skills: "회화, 전시" },
  },
  p7: {
    persona: { id: "p7-taeyang", name: "오태양", profile: "실용음악과 2 · 싱어송라이터", job: "오디션·가요제 마감, 음원·공연 기록" },
    field: "예술·체육", major: "실용음악과", goal: "싱어송라이터 (음원 발매)",
    activity: { name: "대학가요제 본선 오디션", type: "performance", status: "planned", applyDeadline: inDays(9), submitDeadline: inDays(20) },
    evidence: { title: "자작곡 '새벽 세 시' 음원 발매", skills: "작곡, 보컬" },
  },
  p8: {
    persona: { id: "p8-minhyuk", name: "강민혁", profile: "스포츠과학 4 · 트레이너/체육교사", job: "자격증 시험 일정, 지도 경력 정리" },
    field: "예술·체육", major: "스포츠과학과", goal: "퍼스널 트레이너, 체육교사 임용도 고민",
    activity: { name: "생활스포츠지도사 2급 필기시험", type: "exam", status: "applied", applyDeadline: inDays(-5), submitDeadline: inDays(2) },
    evidence: { title: "생활스포츠지도사 2급(보디빌딩) 취득", skills: "운동 지도, 체육" },
  },
  p9: {
    persona: { id: "p9-haneul", name: "윤하늘", profile: "사학과 3 · 학예사 지망", job: "박물관 인턴·자격 준비, 답사 기록" },
    field: "인문·어학", major: "사학과", goal: "박물관 학예사",
    activity: { name: "국립박물관 교육 인턴 (하계)", type: "intern", status: "planned", applyDeadline: inDays(14) },
    evidence: { title: "한국사능력검정 1급", skills: "한국사, 자료 조사" },
  },
  p10: {
    persona: { id: "p10-jiwoo", name: "서지우", profile: "사회복지·심리 3 · 상담사 지망", job: "봉사·실습 시간 관리, 상담 경험 정리" },
    field: "사회·행정", major: "사회복지학과", goal: "청소년 상담사",
    activity: { name: "청소년수련관 멘토링 봉사 (주 1회)", type: "volunteer", status: "active" },
    evidence: { title: "지역아동센터 학습 멘토 120시간", skills: "상담, 멘토링" },
  },
};

for (const [key, p] of Object.entries(PERSONAS)) {
  if (only.length > 0 && !only.includes(key)) continue;
  const { page, see, act, finish } = await startPersona(p.persona);

  await act("가입", () => signup(page, p.persona));

  // 온보딩: 계열을 고르면 어떤 직무가 보이는가
  await act("온보딩 1단계", async () => {
    await page.goto(`${BASE}/career`);
    await page.getByRole("button", { name: p.field, exact: true }).click();
    await page.locator("#ob-major").fill(p.major);
    await page.waitForTimeout(400);
  });
  await see("온보딩 — 고를 수 있는 직무", `${p.major} 학생에게 맞는 직무가 있나`);

  await act("온보딩 마치기", async () => {
    await page.locator("#ob-goal").fill(p.goal);
    await page.getByRole("button", { name: "다음" }).click();
    await page.locator("#ob-headline").waitFor();
  });
  await see("온보딩 — 프로필 단계", "예시 문구가 내 전공에 맞나");
  await act("프로필 단계 넘기기", async () => {
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "내 커리어 시작하기" }).waitFor();
  });
  await see("온보딩 — 스킬 고르기", "내 전공 스킬이 목록에 있나");
  await act("커리어 시작", async () => {
    await page.getByRole("button", { name: "내 커리어 시작하기" }).click();
    await page.getByText("근거가 되는 경험").first().waitFor();
  });
  await see("커리어 첫 화면", "어떤 직무 기준으로 판단하나");

  await act("부족한 부분", () => page.goto(`${BASE}/career/gaps`));
  await see("부족한 부분", "추천 행동이 내 분야에 말이 되나");

  await act("대시보드", () => page.goto(`${BASE}/`));
  await see("대시보드", "오늘의 한 걸음");

  await act("새 활동 화면", () => page.goto(`${BASE}/activities/new`));
  await see("새 활동 화면", "활동 종류·예시가 내 분야를 담나");

  let url;
  await act("활동 등록", async () => {
    url = await addActivity(page, p.activity);
  });
  if (url) {
    await act("활동 상세", () => page.goto(url));
    await see("활동 상세", "날짜 이름·탭이 내 활동에 맞나");
  }

  await act("근거 추가 창", async () => {
    await page.goto(`${BASE}/career`);
    await page.getByRole("button", { name: "근거 추가" }).first().click();
    await page.locator("#ev-title").waitFor();
  });
  await see("근거 추가 창", "작품·공연·자격을 남길 종류와 예시가 있나");
  await act("근거 저장", async () => {
    await page.locator("#ev-title").fill(p.evidence.title);
    await page.locator("#ev-skills").fill(p.evidence.skills);
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await page.getByText(p.evidence.title).filter({ visible: true }).first().waitFor({ timeout: 10000 });
  });
  await see("근거 저장 후 커리어", "근거가 점수에 반영되나");

  await act("기회 찾기", () => page.goto(`${BASE}/opportunities`));
  await see("기회 찾기", "내 분야 공고는 어디서 찾나");

  await finish();
}
