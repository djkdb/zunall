/** 공고문 섹션 읽기 테스트. 실행: npx tsx tests/announcement-parse.test.ts */
import assert from "node:assert/strict";
import { extractListNear, guessActivityType, isSectionHeading, splitListLine } from "@/services/notice/sections";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

const SUBMIT = ["제출물", "제출 서류", "제출서류", "필수 제출", "제출 형식"];

// 웹페이지에서 가져온 공고 — <h2> 머리글이 기호 없이 한 줄씩 온다 (실제로 문제를 일으킨 형태)
const fromWeb = [
  "2026 캐버로 AI 아이디어 공모전",
  "주최: 한국인공지능협회",
  "접수 안내",
  "접수기간: 2026.09.20 ~ 2026.10.20",
  "지원 마감: 2026.10.20",
  "지원 자격",
  "전국 대학생 및 대학원생, 3인 이내 팀",
  "제출 서류",
  "참가신청서, 아이디어 기획서(PDF 15p 이내)",
  "심사 기준",
  "창의성 40%",
  "실현 가능성 35%",
  "사회적 효과 25%",
  "문의",
  "02-000-0000",
].join("\n");

test("기호 없는 머리글에서 멈춘다 — 심사 기준이 제출물에 섞이지 않는다", () => {
  const items = extractListNear(fromWeb, SUBMIT, 6, { split: true });
  assert.deepEqual(items, ["참가신청서", "아이디어 기획서(PDF 15p 이내)"]);
  assert.ok(!items.some((i) => /심사|창의성|실현|사회적|문의/.test(i)), items.join(" | "));
});

test("쉼표로 한 줄에 적은 제출물을 나눠 센다 (준비 시간 계산에 쓰인다)", () => {
  assert.equal(extractListNear(fromWeb, SUBMIT, 6, { split: true }).length, 2);
});

test("괄호 안의 쉼표로는 나누지 않는다", () => {
  assert.deepEqual(splitListLine("포트폴리오(PDF, 20p 이내), 이력서"), ["포트폴리오(PDF, 20p 이내)", "이력서"]);
});

test("머리글 줄에 콜론으로 내용이 붙어 오면 그것도 읽는다", () => {
  const text = "제출 서류: 이력서, 자기소개서\n심사 기준\n서류 50%";
  assert.deepEqual(extractListNear(text, SUBMIT, 6, { split: true }), ["이력서", "자기소개서"]);
});

test("기호가 붙은 머리글(■) 경계도 그대로 지킨다", () => {
  const text = "■ 제출 서류\n- 참가신청서\n- 기획서\n■ 시상 내역\n- 대상 300만원";
  assert.deepEqual(extractListNear(text, SUBMIT, 6, { split: true }), ["참가신청서", "기획서"]);
});

test("번호·콜론이 붙은 머리글도 알아본다", () => {
  assert.equal(isSectionHeading("3. 심사 기준"), true);
  assert.equal(isSectionHeading("심사 기준:"), true);
  assert.equal(isSectionHeading("평가기준"), true);
});

test("내용 줄을 머리글로 오인하지 않는다", () => {
  assert.equal(isSectionHeading("아이디어 기획서(PDF 15p 이내)"), false);
  assert.equal(isSectionHeading("창의성 40%"), false);
  assert.equal(isSectionHeading("심사 기준에 따라 점수를 매깁니다"), false);
});

test("나누지 않는 목록은 예전처럼 한 줄을 한 항목으로", () => {
  const items = extractListNear(fromWeb, ["지원 자격"], 5);
  assert.deepEqual(items, ["전국 대학생 및 대학원생, 3인 이내 팀"]);
});

test("활동 종류는 제목 줄로 먼저 정한다 (혜택 문구의 '인턴'에 끌려가지 않음)", () => {
  const contest = `제7회 대학생 브랜드 마케팅 아이디어 공모전\n■ 시상: 대상 300만원 / 수상팀 소담코스메틱 인턴 지원 시 서류 우대`;
  assert.equal(guessActivityType(contest), "contest");
  assert.equal(guessActivityType("[가람페이] 2026 하반기 서버 개발 체험형 인턴 모집\n■ 전형: 서류"), "intern");
  assert.equal(guessActivityType("2026 공공서비스 UX 개선 아이디어 공모전\n■ 주최: 새솔디자인재단"), "contest");
  assert.equal(guessActivityType("모집 안내\n대학생 서포터즈 10기를 모집합니다"), "supporters", "제목에 없으면 본문으로");
  assert.equal(guessActivityType("안내문\n내용 없음"), "etc");
});

console.log(`\n${passed}개 통과`);
