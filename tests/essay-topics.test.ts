/** 자소서 문항 유형 분류 테스트. 실행: tsx tests/essay-topics.test.ts */
import { classifyQuestion, topicOf, parseTopic, ESSAY_TOPICS } from "../src/services/essay/topics";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) { passed++; console.log(`✅ ${name}`); }
  else { failed++; console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`); }
};
const topic = (q: string) => classifyQuestion(q).topic;

// 실제 공고에서 흔히 보는 문항들
const cases: Array<[string, string]> = [
  ["본 공모전에 지원하게 된 동기를 서술해주세요.", "motivation"],
  ["우리 회사를 선택한 이유는 무엇입니까?", "motivation"],
  ["입사 후 이루고 싶은 목표와 포부를 적어주세요.", "plan"],
  ["성장 과정과 본인의 가치관에 영향을 준 경험을 써주세요.", "growth"],
  ["본인의 강점과 그것을 발휘한 사례를 기술하시오.", "strength"],
  ["자신의 단점과 이를 보완하기 위한 노력을 적어주세요.", "weakness"],
  ["팀 프로젝트에서 갈등을 해결한 경험을 서술해주세요.", "teamwork"],
  ["가장 큰 실패 경험과 그것을 극복한 과정을 적어주세요.", "challenge"],
  ["문제를 해결해 성과를 만든 경험을 구체적으로 기술하시오.", "achievement"],
  ["기존과 다른 창의적인 아이디어를 제안한 경험이 있습니까?", "creativity"],
  ["좋아하는 색깔은 무엇인가요?", "etc"],
  ["", "etc"],
];
for (const [question, expected] of cases) {
  const actual = topic(question);
  check(
    `"${question.slice(0, 24) || "(빈 문항)"}" → ${ESSAY_TOPICS[expected as keyof typeof ESSAY_TOPICS]}`,
    actual === expected,
    `실제: ${actual}`,
  );
}

// 신호가 여럿이면 더 확실한 쪽을 고른다
check(
  "지원 동기가 협업보다 강한 신호",
  topic("팀과 함께 일하고 싶어 지원하게 된 동기를 적어주세요.") === "motivation",
  topic("팀과 함께 일하고 싶어 지원하게 된 동기를 적어주세요."),
);
check("근거 단어를 함께 돌려준다", classifyQuestion("지원 동기를 적어주세요").matched.length > 0);

// 사용자가 직접 고른 유형이 우선
check("직접 고른 유형 우선", topicOf({ question: "지원 동기를 적어주세요", topic: "teamwork" }) === "teamwork");
check("모르는 값은 무시하고 자동 분류", topicOf({ question: "지원 동기를 적어주세요", topic: "없음" }) === "motivation");
check("빈 값이면 자동 분류", topicOf({ question: "협업 경험을 적어주세요", topic: null }) === "teamwork");
check("parseTopic 은 아는 값만", parseTopic("growth") === "growth" && parseTopic("xx") === null);

console.log(`\n${passed}개 통과${failed > 0 ? `, ${failed}개 실패` : ""}`);
if (failed > 0) process.exit(1);
