/** 결과 학습 통계 단위 테스트. 실행: npx tsx tests/outcome.test.ts */
import { computeOutcomeLearning, outcomeOf, type OutcomeInput } from "../src/services/score/outcome";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

const row = (over: Partial<OutcomeInput> = {}): OutcomeInput => ({
  activityId: Math.random().toString(36).slice(2),
  name: "활동",
  type: "contest",
  status: "won",
  fitScore: 85,
  recommendation: "apply",
  ...over,
});

check("결과 분류", outcomeOf("won") === "won" && outcomeOf("lost") === "lost" && outcomeOf("waiting") === "pending");

// 관심/지원예정은 '지원'으로 세지 않는다
const notApplied = computeOutcomeLearning([
  row({ status: "interested" }),
  row({ status: "planned" }),
]);
check("미지원 상태는 집계 제외", notApplied.totalApplied === 0);

// 표본이 적으면 결론 대신 안내
const few = computeOutcomeLearning([row({ status: "won" }), row({ status: "lost" })]);
check("표본 부족 시 안내 문구", few.notice !== null && few.insights.length === 0, few.notice?.slice(0, 30));

// 적합도 구간 비교 (양쪽 표본 충분)
const many = computeOutcomeLearning([
  ...Array.from({ length: 3 }, () => row({ fitScore: 88, status: "won" })),
  ...Array.from({ length: 1 }, () => row({ fitScore: 82, status: "lost" })),
  ...Array.from({ length: 1 }, () => row({ fitScore: 40, status: "won", recommendation: "skip" })),
  ...Array.from({ length: 3 }, () => row({ fitScore: 35, status: "lost", recommendation: "skip" })),
]);
check("전체 합격률 계산", many.overallWinRate === 50, `${many.overallWinRate}%`);
check("적합도 구간별 집계", many.byFit.find((b) => b.label === "적합도 80+")?.won === 3);
check("적합도 높은 쪽이 낫다는 인사이트", many.insights.some((i) => i.includes("적합도 80 이상")), many.insights[0]?.slice(0, 40));
check("비추천 판정 인사이트", many.insights.some((i) => i.includes("지원 비추천")), "");
check("표본 충분하면 안내 문구 없음", many.notice === null);

// 미분석 활동도 별도 구간으로 보인다
const mixed = computeOutcomeLearning([
  row({ fitScore: null, recommendation: null, status: "won" }),
  row({ fitScore: null, recommendation: null, status: "lost" }),
]);
check("적합도 미분석 구간", mixed.byFit[0].label === "적합도 미분석" && mixed.byFit[0].applied === 2);
check("판정 없으면 판정 집계 비움", mixed.byRecommendation.length === 0);

// 유형 라벨 적용
const typed = computeOutcomeLearning(
  Array.from({ length: 4 }, () => row({ type: "intern", status: "won" })),
  { intern: "인턴" },
);
check("유형 라벨 반영", typed.byType[0].label === "인턴", typed.byType[0].label);

console.log(failed === 0 ? "\n모든 테스트 통과" : `\n${failed}개 실패`);
process.exit(failed === 0 ? 0 : 1);
