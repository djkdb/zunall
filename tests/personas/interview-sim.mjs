/**
 * 모의 면접 페르소나 시뮬레이션 (실제 AI 로 돌릴 때 쓴다).
 *
 * 실행: AI_PROVIDER=claude 로 띄운 앱에서
 *   PERSONA_OUT=/tmp/iv node tests/personas/interview-sim.mjs [i1 i2 ...]
 * 페르소나마다 면접 한 번을 끝까지 보고, 질문·꼬리질문·면접관 반응·답변별 대기 시간·리포트를 남긴다.
 */
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "../browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.PERSONA_OUT ?? "/tmp/interview-sim";
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);

const PERSONAS = {
  i1: {
    name: "백엔드 지망 (IT)",
    role: "백엔드",
    pick: /백엔드 개발자/,
    answers: [
      "컴퓨터공학과 4학년이고, 동아리에서 예약 서비스 백엔드를 맡아 Spring Boot로 API를 만들었습니다. 트래픽이 몰리는 시간에 응답이 느려지는 문제를 겪으면서 성능 개선에 관심이 커졌습니다.",
      "예약 조회 API가 피크 시간에 2초 넘게 걸려서, 쿼리 로그를 보니 N+1 문제가 있었습니다. fetch join으로 바꾸고 자주 보는 목록은 Redis에 5분 캐시를 둬서 평균 응답을 300ms로 줄였습니다.",
      "캐시 때문에 예약 직후 목록에 바로 안 보이는 문제가 생겨서, 예약이 생기면 해당 키를 지우도록 했습니다. 팀원과 캐시 시간을 두고 의견이 달랐는데 실제 예약 빈도를 보여주고 5분으로 합의했습니다.",
      "잘 모르겠습니다.",
      "장애가 나면 먼저 영향 범위를 확인하고, 최근 배포가 있었다면 롤백부터 검토하겠습니다. 그다음 로그와 지표로 원인을 좁히겠습니다.",
      "제 약점은 혼자 오래 붙잡는 습관입니다. 그래서 30분 넘게 막히면 팀에 공유하는 규칙을 정해 지키고 있습니다.",
      "열심히 하겠습니다.",
      "네, 감사합니다.",
    ],
  },
  i2: {
    name: "간호사 지망 (보건)",
    role: "간호사",
    pick: /^간호사/,
    answers: [
      "간호학과 4학년이고, 대학병원 내과 병동과 응급실에서 실습했습니다. 환자 상태 변화를 빨리 알아차리는 간호사가 되고 싶습니다.",
      "응급실 실습 때 환자 산소포화도가 88%로 떨어진 걸 보고 바로 담당 간호사 선생님께 보고했고, 체위를 바꾸고 다시 측정했습니다. 산소 투여가 바로 시작돼 95%로 회복됐습니다.",
      "투약 전에는 항상 5 right를 확인했고, 헷갈리는 약은 반드시 선생님께 다시 여쭤 확인했습니다.",
      "보호자가 화를 내실 때는 먼저 끝까지 말씀을 듣고, 제가 확인할 수 있는 것과 없는 것을 구분해 설명드렸습니다.",
      "교대 근무가 힘들 수 있지만 실습 때 밤 근무를 해 보면서 수면 시간을 고정하는 방법을 찾았습니다.",
      "환자 안전이 가장 중요하다고 생각합니다.",
      "네.",
    ],
  },
  i3: {
    name: "학예사 지망 (인문·예술) + 공공기관",
    role: "학예사",
    pick: /큐레이터/,
    answers: [
      "사학과 3학년이고 지역 박물관에서 교육 프로그램 보조를 6개월 했습니다. 유물의 이야기를 관람객이 이해하기 쉽게 전하는 학예사가 되고 싶습니다.",
      "어린이 체험 프로그램에서 활동지가 어렵다는 의견이 많아, 문장을 줄이고 그림 단서를 넣어 다시 만들었습니다. 참여 아동 설문에서 '재밌었다' 응답이 60%에서 85%로 올랐습니다.",
      "전시 기획은 관람객이 누구인지부터 정하고, 그 사람이 꼭 가져갈 메시지 하나를 먼저 정해야 한다고 생각합니다.",
      "예산이 줄면 대여 유물 대신 소장품 중 덜 알려진 것을 재해석하는 방향을 제안하겠습니다.",
      "한국사능력검정 1급을 땄고, 고문서 강독 스터디를 1년째 하고 있습니다.",
      "감사합니다.",
    ],
  },
};

async function signup(p, name) {
  await p.goto(`${BASE}/signup`);
  await p.getByLabel("이름").fill(name);
  await p.getByLabel("이메일").fill(`ivsim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`);
  await p.getByLabel("비밀번호").fill("interviewsim123!");
  await p.locator('input[name="agree"]').check();
  await p.getByRole("button", { name: "회원가입" }).click();
  await p.waitForURL(`${BASE}/`);
}

const b = await launchBrowser();
for (const [key, persona] of Object.entries(PERSONAS)) {
  if (only.length && !only.includes(key)) continue;
  const log = [];
  const p = await b.newPage();
  p.setDefaultTimeout(240000);
  const errors = [];
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  try {
    await signup(p, persona.name);
    await p.goto(`${BASE}/interview/new`);
    await p.locator("#mi-role").fill(persona.role);
    await p.getByRole("option", { name: persona.pick }).first().click();
    await p.getByRole("radio", { name: /^3개/ }).click();
    let t = Date.now();
    await p.getByRole("button", { name: "면접 시작" }).click();
    await p.waitForURL(/\/interview\/[a-z0-9]{20}$/);
    await p.getByTestId("mi-question").waitFor();
    log.push(`[시작] ${Math.round((Date.now() - t) / 1000)}초`);
    for (const answer of persona.answers) {
      const done = await p.getByTestId("mi-overall").count();
      if (done) break;
      await p.locator("#mi-answer:not([disabled])").waitFor();
      const q = await p.getByTestId("mi-question").innerText();
      const card = await p.locator('[aria-live="polite"]').innerText();
      log.push(`\n${card.replace(q, "").trim()}\nQ: ${q}\nA: ${answer}`);
      t = Date.now();
      await p.locator("#mi-answer").fill(answer);
      await p.getByRole("button", { name: "답변 제출" }).click();
      await Promise.race([p.getByTestId("mi-overall").waitFor(), p.locator("#mi-answer:not([disabled])").waitFor()]);
      log.push(`  (면접관 대기 ${Math.round((Date.now() - t) / 1000)}초)`);
    }
    if (!(await p.getByTestId("mi-overall").count())) {
      p.once("dialog", (d) => d.accept());
      await p.getByRole("button", { name: "면접 끝내기" }).click();
    }
    await p.getByTestId("mi-overall").waitFor();
    log.push(`\n===== 리포트 =====\n${await p.locator("main").innerText()}`);
    await p.screenshot({ path: path.join(OUT, `${key}-result.png`), fullPage: true });
  } catch (error) {
    log.push(`\n!!! 실패: ${error instanceof Error ? error.message : error}`);
  }
  if (errors.length) log.push(`\n콘솔 오류: ${errors.join(" | ")}`);
  fs.writeFileSync(path.join(OUT, `${key}.txt`), log.join("\n"));
  console.log(`${key} ${persona.name} → ${path.join(OUT, `${key}.txt`)}`);
  await p.close();
}
await b.close();
