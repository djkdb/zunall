/** 진로 탐색 모드와 직무 매칭. 실행: npx tsx tests/explore.test.ts */
import assert from "node:assert/strict";
import { isExploringGoal, exploreCandidates } from "@/services/career/explore";
import { matchTemplate, templateHits } from "@/services/career/templates";

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

test("진로 미정 문장을 알아챈다", () => {
  for (const text of [
    "아직 잘 모르겠어요. 출판이나 콘텐츠 쪽?",
    "진로 고민 중",
    "미정",
    "하고 싶은 걸 찾는 중입니다",
    "마케팅이나 기획 생각 중",
  ]) {
    assert.equal(isExploringGoal(text), true, text);
  }
});

test("정한 목표는 탐색으로 보지 않는다", () => {
  for (const text of ["네카라쿠배 백엔드 개발자", "데이터 분석가", "UX 디자이너 취업", "CJ 마케터 신입 공채"]) {
    assert.equal(isExploringGoal(text), false, text);
  }
  assert.equal(isExploringGoal(null), false);
});

test("페르소나 3(서연): 출판·콘텐츠 → 언론과 크리에이터를 후보로, 3개까지", () => {
  const list = exploreCandidates("아직 잘 모르겠어요. 출판이나 콘텐츠 쪽?", "humanities", [
    { name: "글쓰기", score: 30 },
  ]);
  const keys = list.map((c) => c.key);
  assert.ok(keys.includes("media"), keys.join(","));
  assert.ok(keys.includes("creator"), keys.join(","));
  assert.equal(list.length, 3);
  assert.ok(!keys.includes("general"));
  const media = list.find((c) => c.key === "media")!;
  assert.ok(media.keySkills.includes("글쓰기"));
  assert.deepEqual(media.overlap, ["글쓰기"], "근거가 있는 역량은 겹침으로 보여준다");
  assert.ok(media.experiment.minutes <= 120, "첫 실험은 2시간 안쪽");
});

test("단어가 하나도 안 걸려도 후보는 비지 않는다 (계열 → 많이 가는 길)", () => {
  const list = exploreCandidates("모르겠어요", null, []);
  assert.ok(list.length >= 2, String(list.length));
});

test("짧은 영문 키워드는 단어 안에서 걸리지 않는다", () => {
  // 예전에는 "product" 안의 "pr" 때문에 언론/PR 이 같이 걸렸다
  assert.ok(!templateHits("product designer").some((h) => h.template.key === "media"));
  assert.ok(!templateHits("library 사서").some((h) => h.template.key === "finance"));
  assert.ok(templateHits("PR 대행사 인턴").some((h) => h.template.key === "media"));
  assert.ok(templateHits("PM 지망").some((h) => h.template.key === "pm"));
  assert.ok(templateHits("ux디자이너").some((h) => h.template.key === "designer"));
});

test("목표 문장 매칭은 그대로 동작한다", () => {
  const goal = (name: string) => ({ name, type: "ROLE", targetRoles: [] });
  assert.equal(matchTemplate(goal("네카라쿠배 백엔드")).key, "backend");
  assert.equal(matchTemplate(goal("뷰티 브랜드 마케터")).key, "marketing");
  assert.equal(matchTemplate(goal("UX 디자이너")).key, "designer");
  assert.equal(matchTemplate(goal("아무거나")).key, "general");
  assert.equal(matchTemplate(goal("UX 디자이너"), "data").key, "data", "직접 고른 직무가 우선");
});

console.log(`\n${passed}개 통과`);
