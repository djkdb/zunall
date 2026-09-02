/**
 * 실행: 서버(npm run start 또는 dev)를 3000 포트에 띄운 뒤 `node tests/e2e-smoke.mjs`
 * 필요: playwright-core + Chromium (CHROMIUM_PATH 환경변수로 경로 지정 가능)
 *
 * E2E 스모크 테스트: 회원가입 → 활동 생성 → 공고 업로드 → AI 공고 분석 →
 * 분석 결과 반영 → 제출물 생성 → 버전 업로드 → AI 평가 → 작업 생성 → 최종 검토
 */
import { launchBrowser } from "./browser.mjs";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const results = [];
let browser;

function step(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// 테스트용 공고문
const announcement = `2026 제로원 아이디어 공모전 모집 공고

주최: 제로원컴퍼니

■ 접수기간: 2026.08.01 ~ 2026.09.15
지원 마감: 2026년 9월 15일
제출 마감: 2026년 10월 2일
결과 발표: 2026년 10월 10일

■ 지원 자격
- 국내 대학(원) 재학생 및 휴학생
- 개인 또는 3인 이내 팀

■ 필수 제출물
- 참가 신청서 1부
- 기획서 (PDF, 20페이지 이내)
- 결과물 요약본 PDF

■ 평가 기준
아이디어 30점
실현 가능성 25점
창의성 20점
완성도 15점
발표 10점

■ 유의사항
- PDF 형식으로만 제출
- 파일 크기 10MB 이하
- 개인정보 포함 금지
- 표절 시 수상 취소

■ 시상
- 대상 1팀: 500만원
- 최우수상 2팀: 200만원
`;

const proposal = `제로원 공모전 기획서 초안

1. 문제 정의
대학생들은 여러 공모전과 대외활동을 동시에 진행하면서 마감일을 놓치고, 제출물에 대한 객관적인 피드백을 받기 어렵다.
설문조사 결과 응답자 120명 중 78%가 마감 관리 도구의 필요성을 느낀다고 답했다.

2. 해결책
활동 관리와 AI 평가를 통합한 개인용 대외활동 OS를 제안한다.
사용자 인터뷰 5건을 통해 핵심 기능을 검증했다.

3. 기대 효과
- 마감 누락률 60% 감소 (KPI: 주간 활성 사용자 1,000명)
- 제출물 품질 점수 평균 15% 향상

4. 실행 계획
9월: MVP 개발, 10월: 베타 테스트 30명, 11월: 정식 출시
`;

const announcementPath = "/tmp/announcement.txt";
const proposalPath = "/tmp/proposal.txt";
fs.writeFileSync(announcementPath, announcement);
fs.writeFileSync(proposalPath, proposal);

try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  // 1. 회원가입
  const email = `e2e-${Date.now()}@test.local`;
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("이름").fill("E2E 테스터");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("testpass123!");
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL(`${BASE}/`);
  step("회원가입 → 대시보드 진입", true);

  // 2. 활동 생성
  await page.goto(`${BASE}/activities/new`);
  await page.getByLabel("활동명 *").fill("제로원 아이디어 공모전");
  await page.getByLabel("주최기관").fill("제로원컴퍼니");
  await page.getByLabel("활동 종류").selectOption("contest");
  await page.getByLabel("상태").selectOption("active");
  await page.getByLabel("결과물 제출 마감일").fill("2026-10-02");
  await page.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await page.waitForURL(/\/activities\/[a-z0-9]{20}$/, { timeout: 30000 });
  const activityUrl = page.url();
  step("활동 생성 → 상세 페이지", true, activityUrl.split("/").pop());

  // 마감일 자동 일정 확인 (일정 탭 카운트)
  await page.goto(`${activityUrl}?tab=calendar`);
  const eventText = await page.locator("main").textContent();
  step("마감일 → 캘린더 일정 자동 등록", eventText.includes("최종 제출"));

  // 3. 공고문 업로드 (공고/안내)
  await page.goto(`${activityUrl}?tab=documents`);
  await page.getByRole("button", { name: "파일 업로드" }).first().click();
  await page.getByLabel("파일 *").setInputFiles(announcementPath);
  await page.getByLabel("분류").selectOption("notice");
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  await page.waitForSelector("text=announcement.txt", { timeout: 20000 });
  const hasExtracted = (await page.locator("text=텍스트 추출됨").count()) > 0;
  step("공고문 업로드 + 텍스트 추출", hasExtracted);

  // 4. AI 공고문 분석
  await page.goto(`${activityUrl}?tab=ai`);
  await page.getByRole("button", { name: "공고문 분석" }).click();
  await page.waitForURL(/review=/, { timeout: 60000 });
  await page.waitForSelector("text=AI Summary", { timeout: 30000 });
  const summaryText = await page.locator("main").textContent();
  step(
    "AI 공고문 분석 (평가 기준/일정 추출)",
    summaryText.includes("아이디어") && summaryText.includes("2026"),
  );

  // 5. 분석 결과 활동에 반영
  await page.getByRole("button", { name: "선택 항목 반영" }).click();
  await page.waitForSelector("text=활동에 반영되었습니다", { timeout: 20000 });
  step("분석 결과 사용자 확인 후 반영", true);

  await page.goto(`${activityUrl}?tab=ai`);
  const criteriaText = await page.locator("main").textContent();
  step(
    "평가 기준 등록 확인",
    criteriaText.includes("아이디어") && criteriaText.includes("실현 가능성"),
  );

  // 6. 제출물 생성 + 버전 업로드
  await page.goto(`${activityUrl}?tab=submissions`);
  await page.getByRole("button", { name: "제출물 추가" }).click();
  await page.getByLabel("이름 *").fill("기획서");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page.waitForSelector("text=아직 업로드된 버전이 없습니다", { timeout: 20000 });
  step("제출물 생성", true);

  await page.getByRole("button", { name: "버전 업로드" }).first().click();
  await page.getByLabel("파일 *").setInputFiles(proposalPath);
  await page.getByLabel("버전 메모").fill("초안");
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  await page.waitForSelector("text=proposal.txt", { timeout: 20000 });
  step("제출물 v1 업로드", true);

  // 7. AI 평가
  await page.getByRole("button", { name: "AI 평가하기" }).click();
  await page.waitForURL(/tab=ai&review=/, { timeout: 60000 });
  await page.waitForSelector("text=예상 점수", { timeout: 30000 });
  const evalText = await page.locator("main").textContent();
  const hasScore = /\d+(\.\d+)?\s*\/\s*100/.test(evalText);
  step("AI 제출물 평가 (기준별 점수)", hasScore && evalText.includes("항목별 평가"));

  // 8. AI 피드백 → 작업 생성
  const taskButtons = page.getByRole("button", { name: "작업 만들기" });
  if ((await taskButtons.count()) > 0) {
    await taskButtons.first().click();
    await page.waitForSelector("text=작업 등록됨", { timeout: 20000 });
    step("AI 피드백 → 작업(Task) 생성", true);
    await page.goto(`${activityUrl}?tab=tasks`);
    const taskText = await page.locator("main").textContent();
    step("생성된 작업이 칸반에 표시", taskText.includes("AI"));
  } else {
    step("AI 피드백 → 작업(Task) 생성", false, "작업 만들기 버튼 없음");
  }

  // 9. 최종 검토 (Final Check)
  await page.goto(`${activityUrl}?tab=submissions`);
  await page.getByRole("button", { name: "제출 전 최종 검토" }).click();
  await page.waitForURL(/tab=ai&review=/, { timeout: 60000 });
  await page.waitForSelector("text=Final Check", { timeout: 30000 });
  const checkText = await page.locator("main").textContent();
  step("제출 전 최종 검토 (체크리스트)", checkText.includes("체크리스트"));

  // 10. 전역 페이지 확인
  await page.goto(`${BASE}/calendar`);
  const calText = await page.locator("main").textContent();
  step("전역 캘린더 (활동 일정 표시)", calText.includes("제로원"));

  await page.goto(`${BASE}/notifications?filter=all`);
  const notifText = await page.locator("main").textContent();
  step("알림 센터 (파일/AI 알림 생성)", notifText.includes("AI") || notifText.includes("업로드"));

  await page.goto(`${BASE}/stats`);
  const statsText = await page.locator("main").textContent();
  step("통계 페이지 (AI 평균 점수 반영)", statsText.includes("평균 예상 점수"));

  await page.goto(`${BASE}/`);
  const dashText = await page.locator("main").textContent();
  step("대시보드에 활동/일정 반영", dashText.includes("제로원"));
} catch (e) {
  step("E2E 실행", false, e.message?.slice(0, 300));
  console.error(e);
} finally {
  await browser?.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n총 ${results.length}개 중 ${results.length - failed.length}개 통과`);
process.exit(failed.length > 0 ? 1 : 0);
