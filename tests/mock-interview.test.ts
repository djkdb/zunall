/** 모의 면접 엔진 (규칙 기반 면접관). 실행: npx tsx tests/mock-interview.test.ts */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setDataLoader } from "@/services/mock-interview/shared/dataLoader";
import { MockAIProvider } from "@/services/mock-interview/mock/MockAIProvider";
import { answerQuestion, currentQuestion, endInterview, reanswerQuestion, startInterview, withoutGreeting, type EngineDeps } from "@/services/mock-interview/engine";
import type { Interview, InterviewConfig } from "@/services/mock-interview/types";
import { COMMON_ONLY_TRACK, resolveCompany, trackFor } from "@/services/mock-interview/catalog";
import { getCompany, loadCompanyQuestions, questionsForTrack } from "@/services/mock-interview/shared/companies";

setDataLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "interview-data", p), "utf8")));

let passed = 0;
const tests: Array<[string, () => Promise<void>]> = [];
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

const deps: EngineDeps = { ai: null, mock: new MockAIProvider(false) };

function newInterview(patch: Partial<InterviewConfig> = {}): Interview {
  return {
    id: "iv_test",
    createdAt: Date.now(),
    config: {
      position: "마케터",
      experience: "entry",
      interviewType: "mixed",
      difficulty: "normal",
      questionLimit: 3,
      jobDescription: "",
      persona: "professional",
      language: "ko",
      answerTimeLimit: 0,
      voiceEnabled: false,
      liveFeedback: true,
      ...patch,
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
}

const GOOD =
  "지난 학기 교내 카페 SNS 운영을 맡아 인스타그램 팔로워를 3개월 동안 1,200명에서 2,000명으로 늘렸습니다. 처음에는 게시물 반응이 낮아 원인을 보려고 지난 게시물 40개의 저장 수를 정리했고, 메뉴 사진보다 이용 팁 게시물이 저장이 두 배 많다는 걸 확인해 주 2회 팁 콘텐츠로 바꿨습니다. 그 결과 월 방문 고객이 15% 늘었습니다.";

test("시작하면 인사와 첫 질문(자기소개)이 나온다", async () => {
  const step = await startInterview(newInterview(), deps);
  const q = currentQuestion(step.interview);
  assert.ok(q, "첫 질문");
  assert.equal(q!.type, "opening");
  assert.equal(step.lines[0].kind, "greeting");
});

test("AI 가 첫 질문 앞에 붙인 인사는 뗀다 (면접위원장이 이미 인사했다)", async () => {
  assert.equal(withoutGreeting("안녕하세요, 면접을 시작하겠습니다. 먼저 1분 정도로 자기소개를 부탁드립니다."), "먼저 1분 정도로 자기소개를 부탁드립니다.");
  assert.equal(withoutGreeting("면접을 시작하겠습니다. 1분 정도로 간단히 자기소개를 해 주시겠어요?"), "1분 정도로 간단히 자기소개를 해 주시겠어요?");
  assert.equal(withoutGreeting("먼저 자기소개 부탁드립니다."), "먼저 자기소개 부탁드립니다.");
});

test("기업 면접: 직군을 직무에 맞춰 고르고, 못 고르면 공통 질문만 쓴다 (기획자에게 정렬 알고리즘 X)", async () => {
  const naver = getCompany("naver")!;
  assert.equal(trackFor(naver, "서비스기획", "service_planner"), "기획·PM");
  assert.equal(trackFor(naver, "백엔드 개발자", "backend"), "개발");
  const samsung = getCompany("samsung-electronics")!;
  const nurseTrack = trackFor(samsung, "간호사", "nurse");
  const qs = questionsForTrack(await loadCompanyQuestions(samsung.id), nurseTrack);
  assert.ok(qs.every((q) => q.track === "공통" || q.track === nurseTrack), nurseTrack);
  assert.ok(!qs.some((q) => /알고리즘|시간복잡도|자료구조/.test(q.text)), qs.map((q) => q.text).join(" / "));
  assert.equal(resolveCompany("naver", "공통", "서비스기획")?.track, COMMON_ONLY_TRACK, "'공통'을 고르면 공통 질문만");
  assert.equal(resolveCompany("naver", "없는 직군", "서비스기획", "service_planner")?.track, "기획·PM", "목록에 없는 값은 믿지 않는다");
});

test("끝까지 답하면 리포트와 점수가 나온다", async () => {
  let step = await startInterview(newInterview(), deps);
  for (let guard = 0; guard < 12 && !step.finished; guard++) {
    const q = currentQuestion(step.interview)!;
    step = await answerQuestion(step.interview, { questionId: q.id, answer: GOOD, mode: "text", durationSec: 40 }, deps);
  }
  const i = step.interview;
  assert.ok(step.finished, "면접이 끝난다");
  assert.ok(i.completed && i.report, "리포트");
  assert.ok(i.overallScore !== null && i.overallScore > 0);
  assert.ok(i.categoryScores && Object.keys(i.categoryScores).length === 6);
  assert.ok(i.questions.filter((q) => !q.isFollowUp).length === 3, "본 질문 3개");
  assert.ok(i.questions.every((q) => q.feedback && q.answer), "모든 질문에 분석");
  assert.equal(step.lines.at(-1)?.kind, "closing");
});

test("같은 질문에 두 번 답할 수 없다 (중복 제출 방지)", async () => {
  const step = await startInterview(newInterview(), deps);
  const q = currentQuestion(step.interview)!;
  const after = await answerQuestion(step.interview, { questionId: q.id, answer: GOOD, mode: "text", durationSec: 10 }, deps);
  await assert.rejects(() => answerQuestion(after.interview, { questionId: q.id, answer: GOOD, mode: "text", durationSec: 10 }, deps));
});

test("질문을 이해 못 했다고 하면 설명하고 같은 질문을 다시 한다", async () => {
  const step = await startInterview(newInterview(), deps);
  const q = currentQuestion(step.interview)!;
  const after = await answerQuestion(step.interview, { questionId: q.id, answer: "질문이 잘 이해가 안 돼요", mode: "text", durationSec: 3 }, deps);
  assert.equal(after.lines[0].kind, "clarify");
  assert.equal(currentQuestion(after.interview)?.id, q.id, "같은 질문");
  assert.ok(!after.finished);
});

test("욕설을 하면 면접이 그 자리에서 끝난다", async () => {
  const step = await startInterview(newInterview(), deps);
  const q = currentQuestion(step.interview)!;
  const after = await answerQuestion(step.interview, { questionId: q.id, answer: "아 씨발 이런 걸 왜 물어봐", mode: "text", durationSec: 3 }, deps);
  assert.ok(after.finished);
  assert.equal(after.interview.terminated, "conduct");
  assert.ok(after.interview.report?.headline.includes("중단"));
});

test("중간에 끝내면 답한 질문까지만 채점한다", async () => {
  let step = await startInterview(newInterview({ questionLimit: 5 }), deps);
  const q = currentQuestion(step.interview)!;
  step = await answerQuestion(step.interview, { questionId: q.id, answer: GOOD, mode: "text", durationSec: 30 }, deps);
  const ended = await endInterview(step.interview, deps);
  assert.ok(ended.interview.completed && ended.interview.endedEarly);
  assert.equal(ended.interview.questions.length, 1, "답하지 않은 질문은 버린다");
});

test("서류 기반 면접: 자소서 문장을 근거로 묻고, 끝나면 원문은 남기지 않는다", async () => {
  const coverLetter = "카페 SNS 운영을 맡아 팔로워를 3개월 만에 60% 늘렸습니다. 게시물 40개의 저장 수를 분석해 콘텐츠를 바꿨습니다.";
  let step = await startInterview(newInterview({ documents: { resume: "", coverLetter } }), deps);
  for (let guard = 0; guard < 12 && !step.finished; guard++) {
    const q = currentQuestion(step.interview)!;
    step = await answerQuestion(step.interview, { questionId: q.id, answer: GOOD, mode: "text", durationSec: 30 }, deps);
  }
  const i = step.interview;
  assert.ok(i.questions.some((q) => /자기소개서|서류|60%|팔로워/.test(q.text)), i.questions.map((q) => q.text).join(" / "));
  assert.equal(i.config.documents, undefined, "원문 삭제");
  assert.deepEqual(i.usedDocuments, ["coverLetter"]);
});

test("기업 면접: 그 기업 질문 은행에서 묻는다", async () => {
  let step = await startInterview(newInterview({ companyId: "kakao", position: "서비스 기획자", questionLimit: 4 }), deps);
  for (let guard = 0; guard < 14 && !step.finished; guard++) {
    const q = currentQuestion(step.interview)!;
    step = await answerQuestion(step.interview, { questionId: q.id, answer: GOOD, mode: "text", durationSec: 30 }, deps);
  }
  assert.ok(step.interview.questions.some((q) => q.origin === "후기" || q.origin === "공식자료"), step.interview.questions.map((q) => `${q.origin}:${q.text}`).join(" / "));
});

test("비IT 직무(간호사)에 개발 질문을 하지 않는다", async () => {
  let step = await startInterview(newInterview({ position: "간호사", roleId: "nurse", questionLimit: 4 }), deps);
  for (let guard = 0; guard < 14 && !step.finished; guard++) {
    const q = currentQuestion(step.interview)!;
    step = await answerQuestion(step.interview, { questionId: q.id, answer: "응급실 실습에서 환자 상태 변화를 먼저 보고드려 처치가 빨라졌습니다. 우선순위를 정해 활력징후를 다시 확인했습니다.", mode: "text", durationSec: 30 }, deps);
  }
  const text = step.interview.questions.map((q) => q.text).join(" / ");
  assert.ok(!/코드|서버|API|프레임워크|배포/.test(text), text);
});

test("다시 답해 보기: 원래 점수는 그대로, 새 점수가 따로 남는다", async () => {
  let step = await startInterview(newInterview({ questionLimit: 1 }), deps);
  const q = currentQuestion(step.interview)!;
  step = await answerQuestion(step.interview, { questionId: q.id, answer: "열심히 하겠습니다.", mode: "text", durationSec: 5 }, deps);
  while (!step.finished) {
    const c = currentQuestion(step.interview)!;
    step = await answerQuestion(step.interview, { questionId: c.id, answer: GOOD, mode: "text", durationSec: 30 }, deps);
  }
  const first = step.interview.questions[0];
  const { interview, reanswer } = await reanswerQuestion(step.interview, first.id, GOOD, deps);
  assert.equal(interview.questions[0].score, first.score, "원래 점수 유지");
  assert.ok(reanswer.score > (first.score ?? 0), `${reanswer.score} > ${first.score}`);
  assert.equal(interview.reanswers?.length, 1);
});

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      passed++;
      console.log(`✅ ${name}`);
    } catch (error) {
      console.log(`❌ ${name}`);
      console.error(error);
      process.exitCode = 1;
    }
  }
  console.log(`\n${passed}/${tests.length} 통과`);
})();
