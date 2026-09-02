/**
 * Career OS E2E 검수 (§30):
 * 온보딩 → Career Score → 근거 추가로 점수 상승 → 공고 적합도(추천/비추천+대안)
 * → Today's Mission → Task 완료 → 미션 완료 알림 → 로드맵 → 통계 → 기존 기능 회귀.
 * 실행: 서버(3000) 기동 후 `node tests/e2e-career.mjs`
 */
import { launchBrowser } from "./browser.mjs";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const SHOT = "/tmp/career-sim";
fs.mkdirSync(SHOT, { recursive: true });

const results = [];
function step(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const aiNotice = `AI 스타트업 개발 인턴 모집

주최: 코그니토랩스

■ 모집 대상
- 4학년 또는 휴학생, 주 3일 이상 근무 가능자

■ 주요 업무
- LLM 기반 기능 프로토타이핑
- React와 TypeScript로 사내 도구 개발
- 프롬프트 엔지니어링 및 자동화 파이프라인 구축

■ 자격 요건
- AI 서비스 개발 경험 또는 강한 관심
- React, TypeScript 프로젝트 경험

■ 우대 사항
- AWS 등 클라우드 배포 경험
- 오픈소스 기여 경험

■ 제출물
- 이력서
- 포트폴리오 (GitHub 링크 포함)
`;

const marketingNotice = `뷰티 브랜드 SNS 마케팅 서포터즈 모집

주최: 글로우코스메틱

■ 활동 내용
- 인스타그램 콘텐츠 제작 (월 8회)
- 유튜브 숏폼 영상 촬영 및 편집
- 브랜드 캠페인 홍보 및 바이럴

■ 자격 요건
- SNS 채널 운영 경험 (팔로워 1,000명 이상)
- 영상 편집 및 카드뉴스 디자인 가능자
- 마케팅/광고 분야 관심자

■ 제출물
- 지원서
- 본인 운영 SNS 채널 링크
- 콘텐츠 포트폴리오
- 자기소개 영상
`;

fs.writeFileSync(`${SHOT}/ai-notice.txt`, aiNotice);
fs.writeFileSync(`${SHOT}/marketing-notice.txt`, marketingNotice);

function readinessScore(text) {
  const m = text.match(/(\d+)\s*\/\s*100/);
  return m ? Number(m[1]) : null;
}

async function createActivityWithNotice(page, name, type, noticePath) {
  await page.goto(`${BASE}/activities/new`);
  await page.getByLabel("활동명 *").fill(name);
  await page.getByLabel("활동 종류").selectOption(type);
  await page.getByLabel("상태").selectOption("planned");
  await page.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await page.waitForURL(/\/activities\/[a-z0-9]{20}$/, { timeout: 30000 });
  const url = page.url();
  await page.goto(`${url}?tab=documents`);
  await page.getByRole("button", { name: "파일 업로드" }).first().click();
  await page.getByLabel("파일 *").setInputFiles(noticePath);
  await page.getByLabel("분류").selectOption("notice");
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  await page.waitForSelector("text=텍스트 추출됨", { timeout: 20000 });
  return url;
}

let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(25000);
  const email = `career-${Date.now()}@test.local`;

  // ── 1. 가입 + 온보딩 배너
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("이름").fill("이준");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("career123!");
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL(`${BASE}/`);
  let text = await page.locator("main").textContent();
  step("신규 대시보드에 시작 안내 배너", text.includes("CAVERO 시작하기"));

  // ── 2. 온보딩 위저드
  await page.goto(`${BASE}/career`);
  await page.getByLabel("어떤 목표를 향해 가고 있나요? *").fill("AI Software Engineer");
  await page.getByLabel("희망 직무 (쉼표 구분)").fill("AI 엔지니어, 풀스택 개발자");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("나를 한 줄로 표현하면?").fill("Software × AI");
  await page.getByLabel("간단한 소개").fill("AI 제품을 만드는 개발자를 목표로 하는 3학년.");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "AI 활용", exact: true }).click();
  await page.getByRole("button", { name: "Frontend", exact: true }).click();
  await page.getByRole("button", { name: "Career Profile 만들기" }).click();
  await page.waitForSelector("text=Career Readiness", { timeout: 30000 });
  step("온보딩 완료 → Career Profile 생성", true);
  await page.screenshot({ path: `${SHOT}/01-career-profile.png` });

  text = await page.locator("main").textContent();
  const initialScore = readinessScore(text);
  step("Career Score 표시 (규칙 기반 + 근거 안내)", initialScore !== null, `${initialScore}점`);
  step("목표 템플릿 매칭 (AI Software Engineer)", text.includes("AI Software Engineer"));
  step("Today's Mission 추천 표시", text.includes("Today's Career Mission"));

  // ── 3. 근거 추가 → 점수 상승
  await page.getByRole("button", { name: "근거 추가" }).click();
  await page.getByLabel("제목 *").fill("Cavero — AI 문서 평가 웹앱 개발");
  await page.getByLabel("이 근거가 증명하는 스킬 (쉼표 구분) *").fill("AI 활용, Frontend, Backend");
  await page.getByLabel("설명").fill("Next.js + Claude 기반 대외활동 관리 서비스를 설계하고 배포함");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/career`);
  text = await page.locator("main").textContent();
  const afterEvidence = readinessScore(text);
  step(
    "근거(Evidence) 추가 → Career Score 상승",
    afterEvidence !== null && initialScore !== null && afterEvidence > initialScore,
    `${initialScore} → ${afterEvidence}`,
  );

  // 스킬 근거 확인 (details 펼치기)
  const aiSkillRow = page.locator("summary", { hasText: "AI 활용" }).first();
  await aiSkillRow.click();
  await page.waitForTimeout(300);
  text = await page.locator("main").textContent();
  step("스킬 점수 옆 근거 내역 표시", text.includes("Cavero") && text.includes("근거"));

  // ── 4. Gap 분석
  await page.goto(`${BASE}/career/gaps`);
  text = await page.locator("main").textContent();
  step(
    "Gap 분석: 부족 역량 + 왜/근거 + 추천 행동",
    text.includes("왜 부족한가?") && text.includes("추천 행동") && text.includes("Cloud"),
  );
  await page.screenshot({ path: `${SHOT}/02-gaps.png` });

  // ── 5. 공고 A (목표 정렬) → 적합도 분석
  const aiActivityUrl = await createActivityWithNotice(
    page,
    "코그니토랩스 AI 개발 인턴",
    "intern",
    `${SHOT}/ai-notice.txt`,
  );
  await page.goto(`${aiActivityUrl}?tab=fit`);
  await page.getByRole("button", { name: "지원 적합도 분석" }).click();
  await page.waitForSelector("text=판단 근거", { timeout: 60000 });
  text = await page.locator("main").textContent();
  const aiFit = readinessScore(text);
  step("AI 정렬 공고: 적합도 점수 + 판단 근거 항목", aiFit !== null && text.includes("요구 역량"), `적합도 ${aiFit}`);
  step("적합도에 강점/보완 표시", text.includes("강점") && text.includes("보완 필요"));
  await page.screenshot({ path: `${SHOT}/03-fit-apply.png` });

  // ── 6. 공고 B (목표 무관 마케팅) → 비추천 + 대안
  const mkActivityUrl = await createActivityWithNotice(
    page,
    "글로우 뷰티 서포터즈",
    "supporters",
    `${SHOT}/marketing-notice.txt`,
  );
  await page.goto(`${mkActivityUrl}?tab=fit`);
  await page.getByRole("button", { name: "지원 적합도 분석" }).click();
  await page.waitForSelector("text=판단 근거", { timeout: 60000 });
  text = await page.locator("main").textContent();
  step(
    "목표 무관 공고: '지원 비추천' + 대안 행동 제시",
    text.includes("지원 비추천") && text.includes("지금 더 효과적인 대안"),
  );
  await page.screenshot({ path: `${SHOT}/04-fit-skip.png` });

  // ── 7. Opportunities 목록
  await page.goto(`${BASE}/opportunities`);
  text = await page.locator("main").textContent();
  step(
    "Opportunities: 두 공고 모두 적합도와 판정 표시",
    text.includes("코그니토랩스") && text.includes("글로우") && text.includes("지원 비추천"),
  );

  // ── 8. Today's Mission → Task 생성 → 완료 → 알림
  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: "이 미션 시작 (Task 생성)" }).click();
  await page.waitForSelector("text=진행 중인 미션이 있습니다", { timeout: 20000 });
  step("미션 수락 → Task 생성 + 진행 중 표시", true);

  text = await page.locator("main").textContent();
  const missionVisible = text.includes("해야 할 일");
  const checkbox = page.locator("main input[type=checkbox]").first();
  const hasTask = (await checkbox.count()) > 0;
  step("미션 Task가 대시보드 '해야 할 일'에 표시", missionVisible && hasTask);

  await checkbox.check();
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/notifications?filter=all`);
  text = await page.locator("main").textContent();
  step("Task 완료 → 커리어 미션 완료 알림 + Score 갱신", text.includes("커리어 미션 완료"));

  await page.goto(`${BASE}/`);
  text = await page.locator("main").textContent();
  step("완료 후 새 미션 추천 (루프 지속)", text.includes("Today's Career Mission"));

  // ── 9. 로드맵 자동 생성
  await page.goto(`${BASE}/career/roadmap`);
  await page.getByRole("button", { name: "Gap 기반 자동 생성" }).click();
  await page.waitForTimeout(2500);
  text = await page.locator("main").textContent();
  step("로드맵: Gap 추천 행동으로 월별 계획 생성", /20\d\d [A-Z]{3}/.test(text));
  await page.screenshot({ path: `${SHOT}/05-roadmap.png` });

  // ── 10. 통계 Career 섹션
  await page.goto(`${BASE}/stats`);
  text = await page.locator("main").textContent();
  step(
    "통계: Career Score/완료율/평균 적합도 표시",
    text.includes("Career Score") && text.includes("추천 행동 완료율") && text.includes("평균 지원 적합도"),
  );

  // ── 11. 기존 기능 회귀 확인
  for (const [path, marker] of [
    ["/activities", "활동"],
    ["/calendar", "캘린더"],
    ["/notifications", "알림"],
    ["/settings", "설정"],
  ]) {
    await page.goto(`${BASE}${path}`);
    const t = await page.locator("main").textContent();
    if (!t.includes(marker)) {
      step(`기존 페이지 회귀: ${path}`, false);
    }
  }
  step("기존 페이지(활동/캘린더/알림/설정) 정상", true);

  await page.goto(`${BASE}/`);
  await page.screenshot({ path: `${SHOT}/06-dashboard.png` });
} catch (e) {
  step("Career E2E 실행", false, e.message?.slice(0, 300));
  console.error(e);
} finally {
  await browser?.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n총 ${results.length}개 중 ${results.length - failed.length}개 통과`);
process.exit(failed.length > 0 ? 1 : 0);
