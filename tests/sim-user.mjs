/**
 * 사용자 관점 시뮬레이션: 신규 가입자 "박지민"이 공모전 하나를
 * 등록부터 최종 제출 준비까지 관리하는 여정을 실제 브라우저로 밟는다.
 * 정상 흐름뿐 아니라 실수(잘못된 로그인, 필수값 누락, 금지 파일 업로드),
 * 개선 후 재평가(점수 변화), 모바일 화면까지 확인한다.
 */
import { launchBrowser } from "./browser.mjs";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const SHOT_DIR = "/tmp/sim";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const obs = [];
function note(scene, ok, detail = "") {
  obs.push({ scene, ok, detail });
  console.log(`${ok ? "✅" : "⚠️ "} ${scene}${detail ? ` — ${detail}` : ""}`);
}
async function shot(page, name) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

// ── 테스트 파일 준비 ──────────────────────────────────────────
const announcement = `2026 청년 소셜벤처 아이디어 공모전

주최: 한국사회적기업진흥원

■ 접수기간: 2026.08.20 ~ 2026.09.20
지원 마감: 2026년 9월 20일
제출 마감: 2026년 10월 15일
결과 발표: 2026년 10월 30일

■ 지원 자격
- 만 19세~39세 청년 누구나
- 개인 또는 5인 이내 팀

■ 필수 제출물
- 참가 신청서
- 사업 기획서 (PDF 15페이지 이내)
- 발표자료

■ 평가 기준
사회적 가치 30점
실현 가능성 25점
혁신성 20점
지속 가능성 15점
발표 10점

■ 유의사항
- PDF 형식 제출
- 파일당 10MB 이하
- 개인정보 포함 금지

■ 시상
- 대상 1팀: 1,000만원
- 우수상 3팀: 300만원
`;

// v1: 짧고 근거 부족한 초안
const draftV1 = `청년 소셜벤처 기획서 초안

1. 아이디어
버려지는 카페 원두 찌꺼기를 수거해 버섯 재배 키트로 만드는 사업.

2. 계획
카페와 제휴해서 원두 찌꺼기를 모으고, 키트를 만들어 온라인에서 판다.

3. 기대 효과
환경에 좋을 것 같다.
`;

// v2: 수치·사용자 검증·경쟁 비교를 보강한 개선본
const draftV2 = `청년 소셜벤처 기획서 v2 — 원두리사이클

1. 문제 정의
국내 카페에서 연간 약 15만 톤의 커피박이 폐기되며, 처리 비용은 톤당 12만원에 달한다.
서울 시내 카페 30곳 설문 결과 87%가 커피박 처리에 비용 부담을 느낀다고 답했다.

2. 해결책: 커피박 버섯 재배 키트
카페 제휴 수거망을 구축하고, 커피박을 배지로 재활용한 느타리버섯 키트를 판매한다.
사용자 인터뷰 8건에서 "아이와 함께 기를 수 있는 친환경 키트"에 대한 구매 의사 75%를 확인했다.

3. 경쟁 비교
기존 A사 키트는 수입 배지를 사용(원가 8,000원)하지만, 커피박 배지는 원가 2,500원으로
가격 경쟁력이 있으며 지역 카페와의 상생 스토리가 차별점이다.

4. 핵심 지표 (KPI)
- 1차년도 제휴 카페 50곳, 월 커피박 수거량 3톤
- 키트 월 판매 1,200개, 재구매율 30%
- 커피박 재활용을 통한 CO2 절감량 연 18톤

5. 실행 일정
10월 파일럿(카페 5곳) → 12월 크라우드펀딩 → 내년 3월 정식 출시

6. 팀 구성과 지속 가능성
환경공학 전공 2인 + 마케팅 1인. 수익의 5%는 카페 포인트로 환원해 수거망을 유지한다.
`;

const files = {
  announcement: `${SHOT_DIR}/announcement.txt`,
  v1: `${SHOT_DIR}/draft-v1.txt`,
  v2: `${SHOT_DIR}/draft-v2.txt`,
  exe: `${SHOT_DIR}/malware.exe`,
};
fs.writeFileSync(files.announcement, announcement);
fs.writeFileSync(files.v1, draftV1);
fs.writeFileSync(files.v2, draftV2);
fs.writeFileSync(files.exe, "MZfake-binary");

let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  const email = `jimin-${Date.now()}@test.local`;

  // ───────────────────────────── 장면 1. 가입 전 실수
  await page.goto(`${BASE}/login`);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("wrongpass1!");
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForTimeout(1200);
  let text = await page.content();
  note("존재하지 않는 계정 로그인 → 에러 안내", text.includes("이메일 또는 비밀번호가 올바르지 않습니다"));

  await page.goto(`${BASE}/signup`);
  await page.getByLabel("이름").fill("박지민");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("jimin1234!");
  await shot(page, "01-signup");
  await page.locator('input[name="agree"]').check(); // 약관 동의(필수)
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL(`${BASE}/`);
  note("회원가입 즉시 로그인 → 대시보드", true);

  // ───────────────────────────── 장면 2. 빈 상태 둘러보기
  text = await page.locator("main").textContent();
  note("빈 대시보드가 첫 행동(활동 만들기)을 안내", text.includes("첫 활동을 등록해보세요"));
  await shot(page, "02-empty-dashboard");

  await page.goto(`${BASE}/calendar`);
  text = await page.locator("main").textContent();
  note("빈 캘린더 표시", !text.includes("Application error"));
  await page.goto(`${BASE}/stats`);
  text = await page.locator("main").textContent();
  note("빈 통계 페이지 표시", text.includes("총 참여 활동"));

  // ───────────────────────────── 장면 3. 활동 생성 (실수 포함)
  await page.goto(`${BASE}/activities/new`);
  await page.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await page.waitForTimeout(600);
  text = await page.locator("main").textContent();
  note("활동명 없이 제출 → 검증 에러", text.includes("활동명을 입력해주세요"));

  await page.getByLabel("활동명 *").fill("청년 소셜벤처 공모전");
  await page.getByLabel("주최기관").fill("한국사회적기업진흥원");
  await page.getByLabel("활동 종류").selectOption("contest");
  await page.getByLabel("상태").selectOption("planned");
  await page.getByLabel("중요도").selectOption("high");
  await page.getByLabel("태그 (쉼표로 구분)").fill("소셜벤처, 공모전, 수상도전");
  await page.getByLabel("메모").fill("팀원: 수빈, 도윤. 환경 주제로 도전.");
  await page.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await page.waitForURL(/\/activities\/[a-z0-9]{20}$/, { timeout: 30000 });
  const activityUrl = page.url();
  note("활동 생성(마감일은 아직 모름) → 상세 진입", true);
  await shot(page, "03-activity-overview");

  // ───────────────────────────── 장면 4. 공고문 없이 AI부터 눌러보기
  await page.goto(`${activityUrl}?tab=ai`);
  await page.getByRole("button", { name: "공고문 분석" }).click();
  await page.waitForTimeout(2500);
  text = await page.locator("main").textContent();
  note(
    "공고 문서 없이 공고문 분석 → 무엇을 해야 하는지 알려주는 에러",
    text.includes("공고 / 안내") && text.includes("업로드"),
  );
  await shot(page, "04-ai-no-doc-error");

  // ───────────────────────────── 장면 5. 파일 업로드 (금지 파일 → 정상 파일)
  await page.goto(`${activityUrl}?tab=documents`);
  await page.getByRole("button", { name: "파일 업로드" }).first().click();
  await page.getByLabel("파일 *").setInputFiles(files.exe);
  await page.getByLabel("분류").selectOption("notice");
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  await page.waitForTimeout(1500);
  text = await page.content();
  note("exe 업로드 시도 → 형식 거부", text.includes("허용되지 않는 파일 형식"));

  await page.getByLabel("파일 *").setInputFiles(files.announcement);
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  await page.waitForSelector("text=announcement.txt", { timeout: 20000 });
  note("공고문 업로드 + 텍스트 추출 배지", (await page.locator("text=텍스트 추출됨").count()) > 0);

  // 한글 파일명 업로드 (실제 사용자 파일명) — DataTransfer로 브라우저 동작 재현
  await page.getByRole("button", { name: "추가" }).nth(1).click().catch(() => {});
  await page.getByRole("button", { name: "파일 업로드" }).first().click().catch(() => {});
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["작년 수상작 요약본입니다."], "작년 수상작 모음.txt", { type: "text/plain" }));
    const input = document.getElementById("up-file");
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByLabel("분류").selectOption("reference");
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  await page.waitForSelector("text=작년 수상작 모음.txt", { timeout: 20000 });
  note("한글 파일명 업로드·목록 표시", true);
  const dl = await page.evaluate(async () => {
    const link = Array.from(document.querySelectorAll("a[href^='/api/files/']"))[0];
    if (!link) return { ok: false };
    const res = await fetch(link.getAttribute("href"));
    return { ok: res.ok, disposition: res.headers.get("content-disposition") ?? "" };
  });
  note("한글 파일명 다운로드 (RFC 5987 인코딩)", dl.ok && dl.disposition.includes("filename*=UTF-8"));
  await shot(page, "05-documents");


  // ───────────────────────────── 장면 6. 공고 분석 → 확인 → 반영
  await page.goto(`${activityUrl}?tab=ai`);
  await page.getByRole("button", { name: "공고문 분석" }).click();
  await page.waitForURL(/review=/, { timeout: 60000 });
  await page.waitForSelector("text=AI Summary", { timeout: 30000 });
  text = await page.locator("main").textContent();
  note(
    "공고 분석: 지원 마감=기간 종료일(2026.09.20) + 배점표 5개 추출",
    text.includes("2026.09.20") && text.includes("사회적 가치") && text.includes("30%"),
  );
  note("필수 제출물 목록이 섹션 경계를 넘지 않음", !text.includes("■"));
  await shot(page, "06-announcement-analysis");

  await page.getByRole("button", { name: "선택 항목 반영" }).click();
  await page.waitForSelector("text=활동에 반영되었습니다");
  note("사용자 확인 후 일정·기준 반영", true);

  // Overview에서 D-day와 AI Summary 확인
  await page.goto(activityUrl);
  text = await page.locator("main").textContent();
  note(
    "Overview에 D-day 카드·AI Summary·평가 기준 표시",
    text.includes("AI Summary") && text.includes("사회적 가치") && text.includes("지원 마감"),
  );
  await shot(page, "07-overview-after-apply");

  // 캘린더 자동 등록 확인
  await page.goto(`${BASE}/calendar`);
  text = await page.locator("main").textContent();
  note("전역 캘린더에 반영된 일정 표시", text.includes("청년 소셜벤처"));

  // ───────────────────────────── 장면 7. 할 일 관리
  await page.goto(`${activityUrl}?tab=tasks`);
  for (const [title, priority] of [
    ["참가 신청서 작성", "high"],
    ["기획서 초안 작성", "urgent"],
    ["팀 회의 일정 잡기", "medium"],
  ]) {
    await page.getByRole("button", { name: "작업 추가" }).click();
    await page.getByLabel("제목 *").fill(title);
    await page.getByLabel("우선순위").selectOption(priority);
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await page.waitForSelector(`text=${title}`, { timeout: 15000 });
  }
  note("작업 3개 추가 → 칸반 TODO 열에 표시", true);

  // 드래그로 칸반 이동 (TODO → IN PROGRESS)
  try {
    const card = page.locator("div[draggable=true]", { hasText: "기획서 초안 작성" }).first();
    const columns = page.locator("h3:has-text('IN PROGRESS')");
    await card.dragTo(columns.first().locator("xpath=ancestor::div[contains(@class,'rounded-lg')]"));
    await page.waitForTimeout(1500);
    const col = page
      .locator("div.rounded-lg", { has: page.locator("h3", { hasText: "IN PROGRESS" }) })
      .first();
    const moved = (await col.textContent())?.includes("기획서 초안 작성");
    note("칸반 드래그&드롭 이동 (TODO → IN PROGRESS)", !!moved);
  } catch (e) {
    note("칸반 드래그&드롭 이동 (TODO → IN PROGRESS)", false, e.message.slice(0, 120));
  }
  await shot(page, "08-kanban");

  // ───────────────────────────── 장면 8. 제출물 v1 → 평가 (낮은 점수)
  await page.goto(`${activityUrl}?tab=submissions`);
  await page.getByRole("button", { name: "제출물 추가" }).click();
  await page.getByLabel("이름 *").fill("사업 기획서");
  await page.getByLabel("제출 마감일").fill("2026-10-15");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page.waitForSelector("text=아직 업로드된 버전이 없습니다");

  await page.getByRole("button", { name: "버전 업로드" }).first().click();
  await page.getByLabel("파일 *").setInputFiles(files.v1);
  await page.getByLabel("버전 메모").fill("초안 (근거 부족)");
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  await page.waitForSelector("text=draft-v1.txt");

  await page.getByRole("button", { name: "AI 평가하기" }).click();
  await page.waitForURL(/tab=ai&review=/, { timeout: 60000 });
  await page.waitForSelector("text=예상 점수", { timeout: 30000 });
  text = await page.locator("main").textContent();
  const v1Match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*100/);
  const v1Score = v1Match ? parseFloat(v1Match[1]) : null;
  note("v1(부실한 초안) AI 평가", v1Score !== null, `점수 ${v1Score}/100`);
  const hasWeakness = text.includes("부족한 점") && (text.includes("정량적") || text.includes("분량"));
  note("부족한 점이 실제 문서 상태와 일치(분량·근거 부족 지적)", hasWeakness);
  await shot(page, "09-eval-v1");

  // AI 피드백 → 작업 생성
  const btnCount = await page.getByRole("button", { name: "작업 만들기" }).count();
  if (btnCount > 0) {
    await page.getByRole("button", { name: "작업 만들기" }).first().click();
    await page.waitForSelector("text=작업 등록됨");
    note("개선 피드백을 원클릭으로 작업 등록", true);
  } else {
    note("개선 피드백을 원클릭으로 작업 등록", false, "버튼 없음");
  }

  // ───────────────────────────── 장면 9. v2 개선본 → 재평가 (점수 상승 기대)
  await page.goto(`${activityUrl}?tab=submissions`);
  await page.getByRole("button", { name: "버전 업로드" }).first().click();
  await page.getByLabel("파일 *").setInputFiles(files.v2);
  await page.getByLabel("버전 메모").fill("설문·KPI·경쟁 비교 보강");
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  await page.waitForSelector("text=draft-v2.txt");
  note("v2 업로드 → 버전 목록에 v1/v2 나란히 표시", (await page.locator("text=v1").count()) > 0);

  await page.getByRole("button", { name: "AI 평가하기" }).click();
  await page.waitForURL(/tab=ai&review=/, { timeout: 60000 });
  await page.waitForSelector("text=예상 점수", { timeout: 30000 });
  text = await page.locator("main").textContent();
  const v2Match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*100/);
  const v2Score = v2Match ? parseFloat(v2Match[1]) : null;
  note(
    "v2(개선본) 재평가 → 점수 상승",
    v1Score !== null && v2Score !== null && v2Score > v1Score,
    `${v1Score} → ${v2Score}`,
  );
  await shot(page, "10-eval-v2");

  // ───────────────────────────── 장면 10. Final + 최종 검토 + 제출 완료
  await page.goto(`${activityUrl}?tab=submissions`);
  await page.getByRole("button", { name: "Final 업로드" }).click();
  await page.getByLabel("파일 *").setInputFiles(files.v2);
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  await page.waitForSelector("text=Final");
  text = await page.locator("main").textContent();
  note("Final 업로드 → 왕관 배지 + 상태 '최종 확정' 자동 전환", text.includes("최종 확정"));

  await page.getByRole("button", { name: "제출 전 최종 검토" }).click();
  await page.waitForURL(/tab=ai&review=/, { timeout: 60000 });
  await page.waitForSelector("text=Final Check", { timeout: 30000 });
  text = await page.locator("main").textContent();
  note("Final Check 체크리스트(마감·형식·개인정보 등)", text.includes("체크리스트") && text.includes("개인정보"));
  await shot(page, "11-final-check");

  // 상태를 '제출 완료'로
  await page.goto(`${activityUrl}?tab=submissions`);
  await page.getByLabel("제출물 상태 변경").selectOption("submitted");
  await page.waitForTimeout(1200);
  await page.getByLabel("활동 상태 변경").selectOption("submitted");
  await page.waitForTimeout(1200);
  note("제출물·활동 상태를 '제출 완료'로 변경", true);

  // ───────────────────────────── 장면 11. 기록·검색·알림
  await page.goto(`${activityUrl}?tab=history`);
  text = await page.locator("main").textContent();
  note(
    "기록 탭에 전 과정 타임라인(생성→업로드→AI→상태 변경)",
    text.includes("생성") && text.includes("상태 변경") && text.includes("Final 업로드"),
  );
  await page.getByLabel("나의 역할").fill("팀장 · 기획 총괄");
  await page.locator("#pf-learned").fill("AI 피드백으로 근거 보강의 중요성을 배웠다.");
  await page.getByRole("button", { name: "기록 저장" }).click();
  await page.waitForSelector("text=저장됨");
  note("포트폴리오 기록 저장", true);
  await shot(page, "12-history");

  await page.goto(`${BASE}/activities?q=소셜`);
  text = await page.locator("main").textContent();
  note("검색('소셜') → 활동 카드 + AI 점수 배지 표시", text.includes("청년 소셜벤처") && /AI \d+/.test(text));

  await page.goto(`${BASE}/notifications?filter=all`);
  text = await page.locator("main").textContent();
  note("알림 센터: 파일/AI 알림 누적", text.includes("AI") && text.includes("업로드"));
  await page.getByRole("button", { name: "모두 읽음" }).click();
  await page.waitForTimeout(1000);
  text = await page.locator("main").textContent();
  note("모두 읽음 처리", text.includes("읽지 않은 알림 0개"));

  // ───────────────────────────── 장면 12. 대시보드 최종 + 모바일
  await page.goto(`${BASE}/`);
  await shot(page, "13-dashboard-final");
  text = await page.locator("main").textContent();
  note("대시보드에 활동/할 일/제출물 현황 집계", text.includes("청년 소셜벤처") || text.includes("해야 할 일"));

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.setDefaultTimeout(15000);
  await mobile.goto(`${BASE}/login`);
  await mobile.getByLabel("이메일").fill(email);
  await mobile.getByLabel("비밀번호").fill("jimin1234!");
  await mobile.getByRole("button", { name: "로그인" }).click();
  await mobile.waitForURL(`${BASE}/`);
  await mobile.waitForTimeout(500);
  await shot(mobile, "14-mobile-dashboard");
  const bodyWidth = await mobile.evaluate(() => document.body.scrollWidth <= window.innerWidth + 2);
  note("모바일(390px): 가로 스크롤 없음", bodyWidth);
  await mobile.goto(`${activityUrl}?tab=tasks`);
  const select = mobile.locator("select[aria-label='작업 상태 이동']").first();
  const hasMobileMove = (await select.count()) > 0 && (await select.first().isVisible());
  note("모바일 칸반: 드래그 대신 상태 이동 셀렉트 제공", hasMobileMove);
  await shot(mobile, "15-mobile-kanban");
  await mobile.close();
} catch (e) {
  note("시뮬레이션 실행", false, e.message?.slice(0, 300));
  console.error(e);
} finally {
  await browser?.close();
}

const failed = obs.filter((o) => !o.ok);
console.log(`\n관찰 ${obs.length}건 중 정상 ${obs.length - failed.length}건, 문제 ${failed.length}건`);
if (failed.length) {
  console.log("문제 목록:");
  for (const f of failed) console.log(` - ${f.scene}${f.detail ? ` (${f.detail})` : ""}`);
}
