/**
 * 둘러보기 계정에 넣을 "끝난 모의 면접" 예시를 만든다.
 * 실행: npx tsx scripts/gen-demo-interview.ts  → src/services/demo/sample-interview.json
 *
 * 규칙 기반 면접관으로 실제 면접 한 번을 끝까지 진행한 결과를 그대로 저장한다
 * (손으로 쓴 가짜 리포트가 아니라, 같은 엔진이 만든 결과). 둘러보기를 열 때마다
 * 면접을 다시 돌리지 않도록 결과만 넣는다.
 */
import fs from "node:fs";
import path from "node:path";
import { setDataLoader } from "../src/services/mock-interview/shared/dataLoader";
import { MockAIProvider } from "../src/services/mock-interview/mock/MockAIProvider";
import { answerQuestion, currentQuestion, startInterview } from "../src/services/mock-interview/engine";
import type { Interview } from "../src/services/mock-interview/types";

setDataLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "interview-data", p), "utf8")));

/** 질문에 맞는 답을 고른다 (둘러보기에서 동문서답처럼 보이면 안 된다). 하나는 일부러 약하게 둬서 피드백이 보이게. */
const ANSWERS: Array<[RegExp, string]> = [
  [/자기소개/, "경영학과 3학년이고, 교내 학회에서 상권 데이터 분석 프로젝트를 두 번 맡았습니다. 공공데이터로 상권 매출을 분석해 신규 출점 후보 3곳을 제안했고, 그 과정에서 데이터로 판단을 돕는 서비스 기획자가 되고 싶어졌습니다."],
  [/어려웠|힘들었/, "분석 범위를 두고 팀 의견이 갈린 것이 가장 어려웠습니다. 저는 각자 원하는 범위로 하루씩 시험 분석을 돌려보자고 제안했고, 비교해 보니 유동인구 데이터가 매출과 가장 관련이 높아 범위를 좁혔습니다. 덕분에 마감 사흘 전에 초안을 끝냈습니다."],
  [/측정|확인하셨|수치/, "학회 설문은 구글 폼으로 받았고 응답 80건 중 중복 응답 6건을 빼고 74건으로 분석했습니다. 출점 후보는 구청 상권 데이터의 분기 매출과 비교해 검증했습니다."],
  [/강점|약점|기여/, "강점은 의견이 갈릴 때 작게 시험해 보고 결정하는 습관입니다. 약점은 혼자 오래 붙잡는 편이라 지금은 30분 넘게 막히면 팀에 공유합니다."],
  [/경쟁|비교|장단점/, "네이버 지도와 카카오맵을 자주 씁니다. 네이버 지도는 리뷰와 예약이 한곳에 있어 결정이 빠르지만 화면이 복잡하고, 카카오맵은 길찾기가 단순한 대신 장소 정보가 적습니다."],
  [/직접|본인이/, "시험 분석 일정을 짜고 두 범위의 결과를 표로 비교한 건 제가 했습니다. 팀원들이 같은 기준으로 볼 수 있게 비교표를 만들어 공유했습니다."],
  [/이탈|원인/, "결제 단계를 나눠 단계별 이탈률을 먼저 보고, 이탈이 가장 큰 단계에서 배송비가 보이는 시점과 결제 수단을 확인하겠습니다."],
  [/문제 정의|기획안/, "기획안에서는 '퇴근길에 장 볼 곳을 못 정한다'는 문제를 설문 74건으로 확인했고, 그래서 해결책을 '집 근처 3곳 비교'로 좁혔습니다. 문제의 근거가 해결책의 범위를 정했습니다."],
  [/개선|피드백/, "좋은 것 같습니다."],
  [/지원|동기|왜/, "학교 앞 상권이 비어 가는 걸 보며 데이터를 직접 찾아봤고, 사람들이 매일 쓰는 지도·검색 서비스에서 그런 판단을 돕고 싶어 지원했습니다."],
];
const DEFAULT_ANSWER = "학회 프로젝트에서 설문 80건으로 문제를 좁히고, 두 가지 안을 작게 시험해 본 뒤 결과가 나은 쪽을 골랐습니다. 그 결과 마감 전에 제안서를 끝냈습니다.";
const answerFor = (q: string) => ANSWERS.find(([re]) => re.test(q))?.[1] ?? DEFAULT_ANSWER;

(async () => {
  const deps = { ai: null, mock: new MockAIProvider(false) };
  const base: Interview = {
    id: "demo",
    createdAt: Date.UTC(2026, 0, 1, 1, 0, 0),
    config: {
      position: "서비스기획",
      roleId: "service_planner",
      companyId: "naver",
      companyTrack: "기획·PM",
      experience: "entry",
      interviewType: "mixed",
      difficulty: "normal",
      questionLimit: 4,
      jobDescription: "",
      persona: "professional",
      language: "ko",
      documents: {
        resume: "",
        coverLetter:
          "학회 프로젝트에서 분석 범위를 두고 의견이 갈렸습니다. 저는 각자 원하는 범위로 하루씩 시험 분석을 돌려보자고 제안했고, 결과를 놓고 다시 이야기해 범위를 좁혔습니다. 덕분에 마감 사흘 전에 초안을 끝냈습니다.",
      },
      answerTimeLimit: 0,
      voiceEnabled: false,
      liveFeedback: false,
    },
    questions: [],
    overallScore: null,
    categoryScores: null,
    report: null,
    duration: 0,
    completed: false,
    endedEarly: false,
    providers: [],
  };
  let clock = base.createdAt;
  const tick = { ...deps, now: () => (clock += 75_000) };
  let step = await startInterview(base, tick);
  for (let guard = 0; guard < 14 && !step.finished; guard++) {
    const q = currentQuestion(step.interview)!;
    step = await answerQuestion(step.interview, { questionId: q.id, answer: answerFor(q.text), mode: "text", durationSec: 60 }, tick);
  }
  if (!step.finished) throw new Error("면접이 끝나지 않았습니다 — 답변을 늘리세요");
  const out = path.join(process.cwd(), "src/services/demo/sample-interview.json");
  fs.writeFileSync(out, JSON.stringify(step.interview));
  console.log(`${out} (${step.interview.questions.length}문답, ${step.interview.overallScore}점, ${fs.statSync(out).size}B)`);
})();
