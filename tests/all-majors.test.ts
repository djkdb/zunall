/** 문과·예체능도 IT 처럼 쓸 수 있는지. 실행: npx tsx tests/all-majors.test.ts */
import assert from "node:assert/strict";
import { matchTemplate, templatesForField } from "@/services/career/templates";
import { guessActivityType } from "@/services/notice/sections";
import { ACTIVITY_TYPES, deadlineLabels } from "@/lib/constants";
import { EVIDENCE_KINDS, EVIDENCE_WEIGHTS, GAP_ACTION_TEMPLATES, ROLE_TEMPLATES, SKILL_CATALOG } from "@/lib/career-constants";
import { inferEvidenceFromActivities } from "@/services/career/activity-evidence";
import { catalogSkillFor } from "@/services/career/skill-detect";
import { firstExperimentFor } from "@/services/career/explore";
import { computeGaps } from "@/services/career/gap";

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
const goal = (name: string) => ({ name, type: "ROLE", targetRoles: [] });

test("페르소나들의 목표가 '일반 커리어'로 떨어지지 않는다", () => {
  const cases: Array<[string, string]> = [
    ["전시하는 작가 (회화)", "fine_artist"],
    ["싱어송라이터 (음원 발매)", "musician"],
    ["퍼스널 트레이너, 체육교사 임용도 고민", "sports_coach"],
    ["박물관 학예사", "curator"],
    ["청소년 상담사", "counselor"],
    ["뮤지컬 배우", "performer"],
    ["공연기획자", "arts_manager"],
    ["출판사 편집자", "editor"],
    ["웹소설 작가", "writer"],
    ["일본어 번역가", "translator"],
    ["프로축구 구단 프런트", "sports_industry"],
  ];
  for (const [text, key] of cases) assert.equal(matchTemplate(goal(text)).key, key, text);
});

test("기존 IT·상경 매칭은 그대로", () => {
  assert.equal(matchTemplate(goal("네카라쿠배 백엔드")).key, "backend");
  assert.equal(matchTemplate(goal("뷰티 브랜드 마케터")).key, "marketing");
  assert.equal(matchTemplate(goal("헬스케어 서비스 기획자")).key, "pm", "'헬스케어'가 트레이너로 가지 않는다");
});

test("예술·체육·인문 계열을 고르면 고를 직무가 충분하다", () => {
  const arts = templatesForField("arts").map((t) => t.key);
  for (const key of ["fine_artist", "musician", "performer", "arts_manager", "sports_coach", "designer", "creator"]) {
    assert.ok(arts.includes(key), key);
  }
  const humanities = templatesForField("humanities").map((t) => t.key);
  for (const key of ["media", "curator", "editor", "writer", "translator"]) assert.ok(humanities.includes(key), key);
  assert.ok(templatesForField("social").map((t) => t.key).includes("counselor"));
});

test("모든 직무 템플릿의 요구 역량이 카탈로그에 있고, 부족할 때 할 일이 있다", () => {
  const names = new Set(SKILL_CATALOG.map((s) => s.name));
  for (const t of ROLE_TEMPLATES) {
    for (const r of t.requirements) {
      assert.ok(names.has(r.skill), `${t.key}: ${r.skill} 이 카탈로그에 없음`);
      assert.ok((GAP_ACTION_TEMPLATES[r.skill] ?? []).length > 0, `${t.key}: ${r.skill} 추천 행동 없음`);
    }
    assert.ok(firstExperimentFor(t).title.length > 0);
  }
});

test("전시·오디션·자격증·봉사 공고를 알아본다", () => {
  assert.equal(guessActivityType("생활스포츠지도사 2급 필기시험 접수 안내"), "exam");
  assert.equal(guessActivityType("제70회 한국사능력검정시험"), "exam");
  assert.equal(guessActivityType("대학가요제 본선 오디션\n접수: 10월 12일까지"), "performance");
  assert.equal(guessActivityType("2026 청년작가 단체전 참여 작가 모집"), "performance");
  assert.equal(guessActivityType("디자인·영상·공연 공모전"), "contest", "공모전은 공모전");
  assert.equal(guessActivityType("청소년수련관 멘토링 봉사단 모집"), "volunteer");
  assert.equal(guessActivityType("[가람페이] 서버 개발 체험형 인턴 모집"), "intern");
});

test("새 활동 종류가 선택 목록에 있고, IT 전용 종류는 뒤에 있다", () => {
  const keys = Object.keys(ACTIVITY_TYPES);
  for (const k of ["exam", "performance", "volunteer"]) assert.ok(keys.includes(k), k);
  assert.ok(keys.indexOf("exam") < keys.indexOf("hackathon"));
  assert.ok(keys.indexOf("volunteer") < keys.indexOf("opensource"));
});

test("시험의 두 번째 날짜는 '시험일', 공연은 '전시·공연일'", () => {
  assert.equal(deadlineLabels("exam").submitField, "시험일");
  assert.equal(deadlineLabels("exam").announce, "합격 발표");
  assert.equal(deadlineLabels("performance").submit, "전시·공연일");
  assert.equal(deadlineLabels("contest").submitField, "결과물 제출 마감일", "기존 종류는 그대로");
  assert.ok(deadlineLabels("exam").announce.includes("발표"), "대시보드는 '발표'가 든 날짜를 할 일로 보지 않는다");
});

test("붙은 자격증은 자격 근거, 전시·공연은 전시 근거, 봉사는 봉사 근거", () => {
  const evidence = inferEvidenceFromActivities(
    [
      { id: "e1", name: "생활스포츠지도사 2급", organizer: null, type: "exam", status: "won" },
      { id: "e2", name: "한국사능력검정 1급", organizer: null, type: "exam", status: "waiting" },
      { id: "p1", name: "대학가요제 본선 오디션", organizer: null, type: "performance", status: "lost" },
      { id: "v1", name: "지역아동센터 멘토링 봉사", organizer: null, type: "volunteer", status: "active" },
    ],
    new Set(),
    EVIDENCE_WEIGHTS,
  );
  const byId = new Map(evidence.map((e) => [e.id, e]));
  assert.equal(byId.get("activity:e1")?.kind, "certificate");
  assert.ok(byId.get("activity:e1")?.skills.includes("체육 / 코칭"), JSON.stringify(byId.get("activity:e1")));
  assert.equal(byId.get("activity:e2"), undefined, "결과를 기다리는 시험은 아직 근거가 아니다");
  assert.equal(byId.get("activity:p1")?.kind, "exhibition", "오디션에서 떨어져도 무대 경험은 남는다");
  assert.ok(byId.get("activity:p1")?.skills.includes("음악 / 공연 실기"));
  assert.equal(byId.get("activity:v1")?.kind, "volunteer");
  assert.ok(byId.get("activity:v1")?.skills.includes("상담 / 사회복지"), JSON.stringify(byId.get("activity:v1")));
});

test("예체능 스킬 이름이 점수용 역량으로 연결된다", () => {
  assert.equal(catalogSkillFor("작곡"), "음악 / 공연 실기");
  assert.equal(catalogSkillFor("보컬"), "음악 / 공연 실기");
  assert.equal(catalogSkillFor("회화"), "창작 / 작품 활동");
  assert.equal(catalogSkillFor("생활스포츠지도사"), "체육 / 코칭");
  assert.equal(catalogSkillFor("일정 연기"), null, "'연기'는 별칭이 아니다");
});

test("근거 종류에 전시·공연·봉사가 있고 GitHub 은 뒤에 있다", () => {
  const kinds = Object.keys(EVIDENCE_KINDS);
  assert.ok(kinds.includes("exhibition") && kinds.includes("volunteer"));
  assert.ok(kinds.indexOf("exhibition") < kinds.indexOf("github"));
  assert.ok(EVIDENCE_WEIGHTS.exhibition >= EVIDENCE_WEIGHTS.activity);
});

test("트레이너에게 '학교 행사 협찬 제안서'를 권하지 않는다 (직무별 행동)", () => {
  const coach = ROLE_TEMPLATES.find((t) => t.key === "sports_coach")!;
  const gaps = computeGaps(coach, []);
  const sales = gaps.find((g) => g.skill === "영업 / 세일즈")!;
  assert.ok(sales.actions[0].title.includes("체험 수업"), sales.actions[0].title);
  const counselor = ROLE_TEMPLATES.find((t) => t.key === "counselor")!;
  const writing = computeGaps(counselor, []).find((g) => g.skill === "글쓰기")!;
  assert.ok(writing.actions[0].title.includes("사례 기록"), writing.actions[0].title);
  const musician = ROLE_TEMPLATES.find((t) => t.key === "musician")!;
  const creation = computeGaps(musician, []).find((g) => g.skill === "창작 / 작품 활동")!;
  assert.ok(!creation.actions[0].title.includes("작가노트"), "음악 전공에게 작가노트를 권하지 않는다");
});

console.log(`\n${passed}개 통과`);
