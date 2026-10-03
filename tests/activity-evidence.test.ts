/** 등록한 활동 → 추정 근거 테스트. 실행: npx tsx tests/activity-evidence.test.ts */
import assert from "node:assert/strict";
import { inferEvidenceFromActivities } from "@/services/career/activity-evidence";
import { computeSkillScores } from "@/services/score/skill";
import { EVIDENCE_WEIGHTS, ROLE_TEMPLATES } from "@/lib/career-constants";
import { computeOpportunityFit } from "@/services/score/opportunity-fit";

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

const act = (id: string, name: string, type: string, status: string, organizer: string | null = null) =>
  ({ id, name, type, status, organizer });
const infer = (acts: ReturnType<typeof act>[], already = new Set<string>()) =>
  inferEvidenceFromActivities(acts, already, EVIDENCE_WEIGHTS);
const scoreOf = (acts: ReturnType<typeof act>[], skill: string) =>
  computeSkillScores([], infer(acts)).find((s) => s.name === skill)?.score ?? 0;

// 페르소나 1: 서포터즈를 둘 하는 마케터 지망생
const minji = [
  act("a1", "올리브영 대학생 서포터즈 8기", "supporters", "active", "CJ올리브영"),
  act("a2", "아모레퍼시픽 뷰티 앰배서더", "external", "active", "아모레퍼시픽"),
  act("a3", "2026 대학생 광고 마케팅 공모전", "contest", "planned", "한국광고학회"),
];

test("진행 중인 서포터즈는 마케팅 근거가 된다", () => {
  const ev = infer(minji);
  assert.ok(ev.some((e) => e.title.includes("올리브영") && e.skills.includes("마케팅")));
});

test("종류를 '대외활동'으로 골랐어도 이름이 앰배서더면 서포터즈 성격으로 본다", () => {
  const amore = infer(minji).find((e) => e.title.includes("아모레"));
  assert.ok(amore?.skills.includes("마케팅"), JSON.stringify(amore));
});

test("서포터즈 둘이면 마케팅 점수가 오르지만 정식 기록만큼은 아니다", () => {
  const score = scoreOf(minji, "마케팅");
  assert.ok(score >= 25 && score < 60, `마케팅 ${score}점`);
});

test("관련 활동이 있으면 적합도 약점에 '경험이 거의 없음'이라고 쓰지 않는다", () => {
  const skillScores = computeSkillScores([], infer(minji));
  const fit = computeOpportunityFit({
    requirements: { requiredSkills: ["마케팅"], preferredSkills: [], qualifications: [], submissionItems: [] },
    skillScores,
    gaps: [],
    template: ROLE_TEMPLATES.find((t) => t.label === "마케터")!,
  });
  assert.ok(!fit.weaknesses.some((w) => w.includes("마케팅 경험이 거의 없음")), fit.weaknesses.join(" / "));
  assert.ok(fit.weaknesses.some((w) => w.includes("마케팅") && w.includes("근거가 더 필요")), fit.weaknesses.join(" / "));
});

test("정말 아무것도 없으면 그대로 '경험이 거의 없음'이라고 말한다", () => {
  const fit = computeOpportunityFit({
    requirements: { requiredSkills: ["마케팅"], preferredSkills: [], qualifications: [], submissionItems: [] },
    skillScores: [],
    gaps: [],
    template: ROLE_TEMPLATES.find((t) => t.label === "마케터")!,
  });
  assert.ok(fit.weaknesses.some((w) => w.includes("마케팅 경험이 거의 없음")));
});

test("아직 지원 전인 공모전은 경험이 아니다", () => {
  assert.ok(!infer(minji).some((e) => e.title.includes("광고 마케팅 공모전")));
});

// 페르소나 5: 인턴에 여러 번 떨어진 사람
test("떨어진 인턴·결과 대기 인턴은 경험으로 세지 않는다", () => {
  const ev = infer([
    act("b1", "쿠팡 데이터 분석 인턴", "intern", "lost"),
    act("b2", "당근 데이터 분석 인턴", "intern", "waiting"),
    act("b3", "토스 Data Analyst 인턴", "intern", "applied"),
  ]);
  assert.equal(ev.length, 0);
});

test("실제로 일한 인턴은 실무 근거가 된다", () => {
  const [ev] = infer([act("b4", "카카오 데이터 분석 인턴", "intern", "done")]);
  assert.equal(ev?.kind, "work");
  assert.ok(ev?.skills.includes("데이터 분석"), JSON.stringify(ev));
});

test("공모전은 떨어져도 결과물을 만든 경험은 남는다", () => {
  const ev = infer([act("c1", "제7회 데이터 분석 공모전", "contest", "lost")]);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].kind, "project");
});

test("수상하면 수상 근거로 더 무겁게 센다", () => {
  const won = infer([act("c2", "마케팅 아이디어 공모전", "contest", "won")])[0];
  const lost = infer([act("c3", "마케팅 아이디어 공모전", "contest", "lost")])[0];
  assert.equal(won.kind, "award");
  assert.ok((won.weight ?? 0) > (lost.weight ?? 0));
});

test("추정 근거는 같은 종류의 정식 근거보다 가볍다", () => {
  const [ev] = infer([act("d1", "올리브영 서포터즈", "supporters", "done")]);
  assert.ok((ev.weight ?? 0) < EVIDENCE_WEIGHTS.activity);
});

test("이미 근거로 가져온 활동은 두 번 세지 않는다", () => {
  assert.equal(infer(minji, new Set(["a1", "a2"])).length, 0);
});

test("추정 근거는 '근거 N개' 개수에 들어가지 않는다 (검증인 척하지 않는다)", () => {
  const scores = computeSkillScores([], infer(minji));
  const marketing = scores.find((s) => s.name === "마케팅");
  assert.equal(marketing?.evidenceCount, 0);
  assert.ok(marketing!.contributions.every((c) => c.label.includes("추정")));
});

console.log(`\n${passed}개 통과`);
