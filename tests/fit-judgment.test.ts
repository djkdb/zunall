/** 지원 판단이 사람을 잘못 말리지 않는지. 실행: npx tsx tests/fit-judgment.test.ts */
import assert from "node:assert/strict";
import { computeOpportunityFit } from "@/services/score/opportunity-fit";
import { computeGaps } from "@/services/career/gap";
import { computeSkillScores } from "@/services/score/skill";
import { inferEvidenceFromActivities } from "@/services/career/activity-evidence";
import { EVIDENCE_WEIGHTS, ROLE_TEMPLATES } from "@/lib/career-constants";

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

// 페르소나 1(민지) 그대로: 마케터 지망, 서포터즈 둘 진행 중, 3일 뒤 마감인 광고 마케팅 공모전
const marketer = ROLE_TEMPLATES.find((t) => t.label === "마케터")!;
const minjiActs = [
  { id: "a1", name: "올리브영 대학생 서포터즈 8기", type: "supporters", status: "active", organizer: "CJ올리브영" },
  { id: "a2", name: "아모레퍼시픽 뷰티 앰배서더", type: "external", status: "active", organizer: "아모레퍼시픽" },
];
const minjiSkills = computeSkillScores(
  [
    { name: "마케팅", category: "domain", selfScore: 40 },
    { name: "콘텐츠 제작", category: "domain", selfScore: 40 },
  ],
  inferEvidenceFromActivities(minjiActs, new Set(), EVIDENCE_WEIGHTS),
);
const minjiGaps = computeGaps(marketer, minjiSkills);
const adContest = {
  requiredSkills: ["마케팅"],
  preferredSkills: [],
  qualifications: [],
  submissionItems: [], // 공고문 없이 이름만으로 분석 — 제출물을 모른다
};
const judge = (days: number | null, noticeKnown: boolean) =>
  computeOpportunityFit({
    requirements: adContest,
    skillScores: minjiSkills,
    gaps: minjiGaps,
    template: marketer,
    daysUntilDeadline: days,
    noticeKnown,
  });

test("가장 부족한 역량을 채우는 기회는 적합도가 낮아도 말리지 않는다", () => {
  const fit = judge(60, false);
  assert.notEqual(fit.recommendation, "skip", `${fit.score}점 · ${fit.recommendationReason}`);
  assert.ok(fit.gapEffect >= 1.5, `gapEffect ${fit.gapEffect}`);
  assert.ok(fit.recommendationReason.includes("마케팅"), fit.recommendationReason);
});

test("그럴 때는 수상보다 결과물을 목표로 하라고 말한다", () => {
  assert.ok(/결과물/.test(judge(60, false).recommendationReason));
});

test("민지의 실제 결과: 3일 뒤 마감인 마케팅 공모전을 말리지 않는다", () => {
  // 서포터즈 경험이 반영돼 마케팅이 '일부 충족' → 준비 시간 추정도 줄어 빠듯하지 않다
  const fit = judge(3, false);
  assert.equal(fit.recommendation, "apply", `${fit.prepHours}시간 · ${fit.recommendationReason}`);
  assert.ok(!fit.weaknesses.some((w) => w.includes("마케팅 경험이 거의 없음")), fit.weaknesses.join(" / "));
});

// 빠듯한 구간을 직접 만든다: 제출물 3개 → 준비 16시간, 마감 5일 → 낼 수 있는 시간 15시간
const tight = { ...adContest, submissionItems: ["기획서", "포스터", "영상"] };
const judgeTight = (noticeKnown: boolean) =>
  computeOpportunityFit({
    requirements: tight,
    skillScores: minjiSkills,
    gaps: minjiGaps,
    template: marketer,
    daysUntilDeadline: 5,
    noticeKnown,
  });

test("빠듯한 마감(준비 16시간 vs 15시간)은 1시간 차이로 단정해 말리지 않는다", () => {
  const fit = judgeTight(true);
  assert.equal(fit.prepHours, 16);
  assert.notEqual(fit.recommendation, "skip", fit.recommendationReason);
  assert.ok(fit.weaknesses.includes("마감까지 빠듯함"), fit.weaknesses.join(" / "));
  assert.ok(fit.recommendationReason.includes("다른 마감과 겹치면"), fit.recommendationReason);
});

test("준비 시간이 공고문 없이 짐작한 값이면 그 사실을 밝힌다", () => {
  const fit = judgeTight(false);
  assert.ok(fit.recommendationReason.includes("짐작"), fit.recommendationReason);
});

test("공고문 없이 짐작한 값이면 확실히 모자라 보여도 말리지 않고 주의만 준다", () => {
  const fit = judge(1, false); // 3시간 vs 10시간
  assert.notEqual(fit.recommendation, "skip", fit.recommendationReason);
  assert.ok(fit.weaknesses.includes("마감까지 남은 시간이 부족함"));
});

test("공고문으로 확인했고 확실히 모자라면 말린다", () => {
  const fit = judge(1, true);
  assert.equal(fit.recommendation, "skip", fit.recommendationReason);
  assert.ok(fit.alternative, "대신 할 일을 준다");
});

test("오늘이 마감이면 '이미 지났다'고 하지 않는다", () => {
  const fit = judge(0, true);
  assert.ok(!fit.recommendationReason.includes("이미 지났"), fit.recommendationReason);
  assert.ok(fit.recommendationReason.includes("오늘이 마감"), fit.recommendationReason);
});

test("어제가 마감이면 지났다고 말한다", () => {
  assert.equal(judge(-1, true).recommendationReason, "지원 마감이 이미 지났습니다.");
});

test("목표와 무관하고 적합도도 낮으면 여전히 말린다 (기존 판단은 그대로)", () => {
  const fit = computeOpportunityFit({
    requirements: { requiredSkills: ["Backend", "Cloud / 배포"], preferredSkills: [], qualifications: [], submissionItems: ["코드", "설계서"] },
    skillScores: minjiSkills,
    gaps: minjiGaps,
    template: marketer,
    daysUntilDeadline: 30,
  });
  assert.equal(fit.recommendation, "skip", fit.recommendationReason);
  assert.ok(/적합도가 낮고/.test(fit.recommendationReason), fit.recommendationReason);
});

console.log(`\n${passed}개 통과`);
