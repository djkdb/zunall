/** 직무에 맞는 추천 행동 테스트. 실행: npx tsx tests/mission-role.test.ts */
import assert from "node:assert/strict";
import { computeGaps } from "@/services/career/gap";
import { pickMission, rankActions } from "@/services/career/mission";
import { computeSkillScores } from "@/services/score/skill";
import { ROLE_TEMPLATES } from "@/lib/career-constants";

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

const designer = ROLE_TEMPLATES.find((t) => t.key === "designer")!;
const frontendDev = ROLE_TEMPLATES.find((t) => t.label === "프론트엔드 개발자")!;
// 페르소나 4: 막 온보딩을 마친 산업디자인과 학생 (디자인만 골랐고 근거 없음)
const fresh = computeSkillScores([{ name: "디자인", category: "domain", selfScore: 40 }], []);

test("디자이너에게 개발자용 행동(README·기술 설명)을 권하지 않는다", () => {
  const gaps = computeGaps(designer, fresh);
  const all = gaps.flatMap((g) => g.actions.map((a) => a.title));
  assert.ok(!all.some((t) => /README|기술 설명|배포/.test(t)), all.join(" | "));
});

test("디자이너의 Frontend 는 디자이너 언어로 권한다", () => {
  const frontend = computeGaps(designer, fresh).find((g) => g.skill === "Frontend");
  assert.ok(frontend?.actions.some((a) => /시안|핸드오프/.test(a.title)), JSON.stringify(frontend?.actions));
});

test("오늘의 한 걸음이 부수 역량(Frontend)의 짧은 일로 가지 않는다", () => {
  const mission = pickMission(computeGaps(designer, fresh), new Set());
  assert.ok(mission, "추천이 있어야 한다");
  assert.notEqual(mission!.skill, "Frontend", `${mission!.skill}: ${mission!.title}`);
});

test("개발자에게는 여전히 개발자용 행동을 권한다", () => {
  const gaps = computeGaps(frontendDev, computeSkillScores([], []));
  const frontend = gaps.find((g) => g.skill === "Frontend");
  assert.ok(frontend?.actions.some((a) => /배포|README/.test(a.title)), JSON.stringify(frontend?.actions));
});

test("추천 목록 상위는 직무 핵심 역량부터 채운다", () => {
  const top = rankActions(computeGaps(designer, fresh), new Set(), 3).map((a) => a.skill);
  assert.ok(!top.slice(0, 2).includes("Frontend"), top.join(", "));
});

console.log(`\n${passed}개 통과`);
