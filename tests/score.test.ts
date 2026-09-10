/**
 * 점수 레이어 단위 테스트 (순수 함수 검증).
 * 실행: npm run test:score
 */
import assert from "node:assert/strict";
import { computeSkillScores, pointsToScore } from "@/services/score/skill";
import { computeReadiness } from "@/services/score/readiness";
import { computeGaps } from "@/services/career/gap";
import { computeOpportunityFit } from "@/services/score/opportunity-fit";
import { pickMission } from "@/services/career/mission";
import { matchTemplate } from "@/services/career/templates";
import { detectSkills, normalizeSkillNames } from "@/services/career/skill-detect";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (e) {
    console.error(`❌ ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

// ── skill ────────────────────────────────────────────────────
test("pointsToScore: 수확 체감 곡선", () => {
  assert.equal(pointsToScore(0), 0);
  assert.ok(pointsToScore(45) >= 60 && pointsToScore(45) <= 66);
  assert.ok(pointsToScore(90) > pointsToScore(45));
  assert.ok(pointsToScore(500) <= 100);
});

test("computeSkillScores: 근거가 점수와 기여 내역을 만든다", () => {
  const scores = computeSkillScores(
    [{ name: "AI 활용", category: "tech", selfScore: null }],
    [
      { id: "e1", kind: "project", title: "AI 프로젝트", skills: ["AI 활용"] },
      { id: "e2", kind: "award", title: "AI 공모전 수상", skills: ["AI 활용"] },
    ],
  );
  const ai = scores.find((s) => s.name === "AI 활용")!;
  assert.ok(ai.score > 40, `score=${ai.score}`);
  assert.equal(ai.evidenceCount, 2);
  assert.equal(ai.contributions.length, 2);
  assert.ok(ai.contributions.every((c) => c.points > 0));
});

test("computeSkillScores: 근거 없는 스킬은 자가평가만으로 높은 점수를 받지 못한다", () => {
  const scores = computeSkillScores(
    [{ name: "Backend", category: "tech", selfScore: 100 }],
    [],
  );
  const backend = scores.find((s) => s.name === "Backend")!;
  assert.ok(backend.score <= 30, `자가평가만으로 score=${backend.score}`);
  assert.ok(backend.confidence <= 0.2);
});

test("computeSkillScores: 근거에만 등장한 스킬도 자동 포함", () => {
  const scores = computeSkillScores(
    [],
    [{ id: "e1", kind: "project", title: "웹앱", skills: ["Frontend"] }],
  );
  assert.ok(scores.some((s) => s.name === "Frontend"));
});

// ── template / gap ───────────────────────────────────────────
const aiTemplate = matchTemplate({ name: "AI Software Engineer", type: "ROLE", targetRoles: [] });

test("matchTemplate: 목표 텍스트로 템플릿 매칭", () => {
  assert.equal(aiTemplate.key, "ai_engineer");
  assert.equal(matchTemplate(null).key, "general");
  assert.equal(matchTemplate({ name: "프론트엔드 개발자", type: "ROLE", targetRoles: [] }).key, "frontend");
});

test("computeGaps: 부족한 스킬만 gap으로, 큰 순서로 정렬", () => {
  const skillScores = computeSkillScores(
    [],
    [
      { id: "e1", kind: "award", title: "AI 수상", skills: ["AI 활용"] },
      { id: "e2", kind: "project", title: "AI 프로젝트1", skills: ["AI 활용"] },
      { id: "e3", kind: "project", title: "AI 프로젝트2", skills: ["AI 활용"] },
      { id: "e4", kind: "project", title: "AI 프로젝트3", skills: ["AI 활용", "Frontend"] },
      { id: "e5", kind: "work", title: "인턴", skills: ["AI 활용", "Backend"] },
    ],
  );
  const gaps = computeGaps(aiTemplate, skillScores);
  assert.ok(gaps.length > 0);
  // Cloud는 근거가 없으므로 gap에 포함
  const cloud = gaps.find((g) => g.skill === "Cloud / 배포");
  assert.ok(cloud, "Cloud gap 존재");
  assert.equal(cloud!.current, 0);
  assert.ok(cloud!.actions.length > 0, "추천 행동 존재");
  assert.ok(cloud!.whyLacking.includes("경험"), "부족 사유에 경험 언급");
  // 정렬 확인
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i - 1].gap >= gaps[i].gap);
});

// ── readiness ────────────────────────────────────────────────
test("computeReadiness: 항목 합산 = 총점, 설명 포함", () => {
  const skillScores = computeSkillScores(
    [],
    [
      { id: "e1", kind: "project", title: "P1", skills: ["AI 활용", "Frontend"] },
      { id: "e2", kind: "award", title: "수상", skills: ["AI 활용"] },
    ],
  );
  const result = computeReadiness({
    template: aiTemplate,
    skillScores,
    evidenceCount: 2,
    activityStats: { total: 3, finished: 1, won: 1 },
    profile: { hasGoal: true, hasHeadline: true, hasSummary: false, skillCount: 4 },
  });
  const sum = result.items.reduce((s, i) => s + i.points, 0);
  assert.equal(result.score, Math.min(100, sum));
  assert.ok(result.items.every((i) => i.detail.length > 0));
  assert.ok(result.score > 0 && result.score < 100);
});

test("computeReadiness: 근거가 늘면 점수가 오른다", () => {
  const few = computeSkillScores([], [
    { id: "e1", kind: "project", title: "P1", skills: ["AI 활용"] },
  ]);
  const many = computeSkillScores([], [
    { id: "e1", kind: "project", title: "P1", skills: ["AI 활용"] },
    { id: "e2", kind: "project", title: "P2", skills: ["Backend"] },
    { id: "e3", kind: "work", title: "인턴", skills: ["Cloud / 배포"] },
    { id: "e4", kind: "award", title: "수상", skills: ["AI 활용", "문제 해결"] },
  ]);
  const base = { template: aiTemplate, activityStats: { total: 2, finished: 1, won: 0 }, profile: { hasGoal: true, hasHeadline: true, hasSummary: true, skillCount: 3 } };
  const low = computeReadiness({ ...base, skillScores: few, evidenceCount: 1 });
  const high = computeReadiness({ ...base, skillScores: many, evidenceCount: 4 });
  assert.ok(high.score > low.score, `${low.score} → ${high.score}`);
});

// ── opportunity fit ──────────────────────────────────────────
test("computeOpportunityFit: 역량 매치가 점수와 근거를 만든다", () => {
  const skillScores = computeSkillScores(
    [],
    [
      { id: "e1", kind: "award", title: "AI 수상", skills: ["AI 활용"] },
      { id: "e2", kind: "project", title: "AI 서비스", skills: ["AI 활용", "Frontend"] },
      { id: "e3", kind: "project", title: "웹앱", skills: ["Frontend"] },
      { id: "e4", kind: "work", title: "개발 인턴", skills: ["Frontend", "AI 활용"] },
    ],
  );
  const gaps = computeGaps(aiTemplate, skillScores);
  const fit = computeOpportunityFit({
    requirements: {
      requiredSkills: ["AI 활용", "Frontend"],
      preferredSkills: ["Cloud / 배포"],
      qualifications: ["대학생"],
      submissionItems: ["기획서"],
    },
    skillScores,
    gaps,
    template: aiTemplate,
  });
  assert.ok(fit.score >= 60, `score=${fit.score}`);
  assert.ok(fit.breakdown.length >= 3);
  assert.ok(fit.strengths.length >= 1);
  assert.equal(fit.recommendation, "apply");
});

test("computeOpportunityFit: 목표와 무관+역량 부족이면 skip과 대안 제시", () => {
  const skillScores = computeSkillScores(
    [],
    [{ id: "e1", kind: "project", title: "AI 프로젝트", skills: ["AI 활용"] }],
  );
  const gaps = computeGaps(aiTemplate, skillScores);
  const fit = computeOpportunityFit({
    requirements: {
      requiredSkills: ["마케팅", "콘텐츠 제작", "디자인"],
      preferredSkills: [],
      qualifications: [],
      submissionItems: ["포트폴리오", "SNS 채널", "영상"],
    },
    skillScores,
    gaps,
    template: aiTemplate,
  });
  assert.equal(fit.recommendation, "skip");
  assert.ok(fit.alternative, "대안 행동 제시");
  assert.ok(fit.prepHours > 10);
  assert.ok(fit.weaknesses.length >= 2);
});

// ── "지금 나에게 좋은 기회인가" — 적합도만으로 정하지 않는다 ──────────────

/** 두 역량에 근거가 몰려 있어 그 둘을 요구하는 공고에는 적합도가 높게 나오는 사용자 */
function wellMatched() {
  const skillScores = computeSkillScores(
    [],
    [
      { id: "e1", kind: "award", title: "AI 수상", skills: ["AI 활용"] },
      { id: "e2", kind: "project", title: "AI 서비스", skills: ["AI 활용", "Frontend"] },
      { id: "e3", kind: "project", title: "웹앱", skills: ["Frontend"] },
      { id: "e4", kind: "work", title: "개발 인턴", skills: ["Frontend", "AI 활용"] },
    ],
  );
  return { skillScores, gaps: computeGaps(aiTemplate, skillScores) };
}

test("computeOpportunityFit: 마감까지 시간이 모자라면 적합도가 높아도 말린다", () => {
  const { skillScores, gaps } = wellMatched();
  // 시간만 있으면 지원할 만한 공고 (부족한 Cloud / 배포도 함께 채워진다)
  const requirements = {
    requiredSkills: ["AI 활용", "Frontend"],
    preferredSkills: ["Cloud / 배포"],
    qualifications: [],
    submissionItems: ["기획서", "시연 영상", "코드", "발표자료", "포트폴리오"],
  };

  const roomy = computeOpportunityFit({
    requirements,
    skillScores,
    gaps,
    template: aiTemplate,
    daysUntilDeadline: 60,
  });
  const rushed = computeOpportunityFit({
    requirements,
    skillScores,
    gaps,
    template: aiTemplate,
    daysUntilDeadline: 2,
  });

  // 같은 공고인데 마감만 다르다 — 점수는 같고 판단만 뒤집혀야 한다
  assert.equal(roomy.score, rushed.score, "적합도 자체는 마감과 무관");
  assert.equal(roomy.recommendation, "apply", "시간이 있으면 지원할 만한 공고");
  assert.equal(rushed.recommendation, "skip", "시간이 모자라면 말린다");
  assert.ok(rushed.recommendationReason.includes("마감까지 2일"), rushed.recommendationReason);
  assert.ok(rushed.alternative, "말릴 때는 대신 할 일을 준다");
  assert.ok(rushed.weaknesses.some((w) => w.includes("시간")));
});

test("computeOpportunityFit: 마감이 지났으면 그 사실을 말한다", () => {
  const { skillScores, gaps } = wellMatched();
  const fit = computeOpportunityFit({
    requirements: {
      requiredSkills: ["AI 활용"],
      preferredSkills: [],
      qualifications: [],
      submissionItems: ["기획서"],
    },
    skillScores,
    gaps,
    template: aiTemplate,
    daysUntilDeadline: -3,
  });
  assert.equal(fit.recommendation, "skip");
  assert.ok(fit.recommendationReason.includes("마감이 이미 지났"), fit.recommendationReason);
});

test("computeOpportunityFit: 마감을 모르면 시간을 이유로 말리지 않는다", () => {
  const { skillScores, gaps } = wellMatched();
  const fit = computeOpportunityFit({
    requirements: {
      requiredSkills: ["AI 활용", "Frontend"],
      preferredSkills: [],
      qualifications: [],
      submissionItems: ["기획서", "시연 영상", "코드", "발표자료", "포트폴리오"],
    },
    skillScores,
    gaps,
    template: aiTemplate,
    // daysUntilDeadline 없음
  });
  assert.ok(!fit.recommendationReason.includes("마감까지"), fit.recommendationReason);
  assert.ok(!fit.weaknesses.some((w) => w.includes("남은 시간")));
});

test("computeOpportunityFit: 붙을 만해도 목표에 도움이 안 되면 말리고 대안을 준다", () => {
  // 이미 잘하는 역량만 요구하는 공고 — 합격 가능성은 높지만 배울 게 없다
  const { skillScores, gaps } = wellMatched();
  const fit = computeOpportunityFit({
    requirements: {
      requiredSkills: ["AI 활용", "Frontend"],
      preferredSkills: [],
      qualifications: [],
      submissionItems: ["기획서", "발표자료", "시연 영상", "보고서", "포트폴리오"],
    },
    skillScores,
    gaps,
    template: aiTemplate,
    daysUntilDeadline: 90,
  });

  assert.ok(fit.score >= 68, `적합도는 높아야 한다 (${fit.score})`);
  assert.notEqual(fit.recommendation, "apply", "시간만 쓰는 기회를 추천하면 안 된다");
  if (fit.recommendation === "skip") {
    assert.ok(fit.alternative, "말릴 때는 대신 할 일을 준다");
  }
  assert.ok(
    /기여하지 않습니다|더 급한 준비가 없을 때/.test(fit.recommendationReason),
    fit.recommendationReason,
  );
});

test("computeOpportunityFit: 잘 맞고 시간도 있으면 그대로 추천한다", () => {
  const { skillScores, gaps } = wellMatched();
  const fit = computeOpportunityFit({
    requirements: {
      requiredSkills: ["AI 활용", "Frontend"],
      preferredSkills: ["Cloud / 배포"],
      qualifications: [],
      submissionItems: ["기획서"],
    },
    skillScores,
    gaps,
    template: aiTemplate,
    daysUntilDeadline: 45,
  });
  assert.equal(fit.recommendation, "apply");
  assert.equal(fit.alternative, null, "추천할 때는 대안을 띄우지 않는다");
});

// ── mission ──────────────────────────────────────────────────
test("pickMission: 가장 효율적인 행동을 고르고 이유를 설명한다", () => {
  const skillScores = computeSkillScores(
    [],
    [{ id: "e1", kind: "project", title: "AI", skills: ["AI 활용"] }],
  );
  const gaps = computeGaps(aiTemplate, skillScores);
  const mission = pickMission(gaps, new Set());
  assert.ok(mission);
  assert.ok(mission!.why.includes("부족"), "이유에 gap 설명 포함");
  assert.ok(mission!.expectedEffect > 0 && mission!.expectedMinutes > 0);

  // 제외 목록이 동작
  const second = pickMission(gaps, new Set([mission!.title]));
  assert.ok(!second || second.title !== mission!.title);
});

// ── skill detect ─────────────────────────────────────────────
test("detectSkills: 공고 텍스트에서 역량 감지", () => {
  const skills = detectSkills("React와 TypeScript로 웹 서비스를 만들고 AWS에 배포할 인재. AI 활용 우대.");
  assert.ok(skills.includes("Frontend"));
  assert.ok(skills.includes("Cloud / 배포"));
  assert.ok(skills.includes("AI 활용"));
});

test("normalizeSkillNames: 자유 입력을 카탈로그 이름으로 정규화", () => {
  const names = normalizeSkillNames(["react", "  피그마 ", "나만의스킬"]);
  assert.ok(names.includes("Frontend"));
  assert.ok(names.includes("디자인"));
  assert.ok(names.includes("나만의스킬"));
});

console.log(`\n${passed}개 테스트 통과${process.exitCode ? " (실패 있음)" : ""}`);
