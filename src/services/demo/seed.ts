import "server-only";
import { randomBytes } from "node:crypto";
import { eq, lt, like, and } from "drizzle-orm";
import {
  db,
  users,
  activities,
  events,
  tasks,
  evaluationCriteria,
  essayQuestions,
  essayDrafts,
  interviewQuestions,
  retrospectives,
  careerProfiles,
  careerGoals,
  userSkills,
  careerEvidence,
  notifications,
  opportunityAnalyses,
  scoreSnapshots,
  aiReviews,
  aiReviewItems,
  sessions,
} from "@/lib/db";
import { newId, toDateStr } from "@/lib/utils";
import { classifyQuestion } from "@/services/essay/topics";

/**
 * 둘러보기(데모) 계정.
 *
 * 가입하지 않으면 빈 화면조차 볼 수 없어서, 처음 온 사람이 무엇을 얻는지 알기 어렵다.
 * 방문할 때마다 임시 계정을 하나 만들고 예시 자료를 채워 넣는다.
 * 계정이 서로 분리돼 있어 남의 자료를 보거나 망칠 일이 없다.
 */

/** 데모 계정을 알아보는 표식 (통계에서 빼고, 오래되면 지운다) */
export const DEMO_EMAIL_SUFFIX = "@demo.local";
const DEMO_TTL_MS = 3 * 86400000; // 3일

export function isDemoEmail(email: string): boolean {
  return email.endsWith(DEMO_EMAIL_SUFFIX);
}

const day = (offset: number) =>
  toDateStr(new Date(Date.now() + offset * 86400000));

export async function createDemoUser(): Promise<string> {
  const userId = newId();
  const now = Date.now();

  await db.insert(users).values({
    id: userId,
    email: `demo-${randomBytes(8).toString("hex")}${DEMO_EMAIL_SUFFIX}`,
    name: "둘러보기",
    passwordHash: null,
    termsAgreedAt: now,
    createdAt: now,
  });

  // 클릭 한 번에 앱이 열려야 하므로, 서로 무관한 삽입은 동시에 보낸다
  // (Neon HTTP 는 쿼리 하나가 왕복 하나라, 순서대로 넣으면 그만큼 기다린다)
  await Promise.all([seedCareer(userId, now), seedActivities(userId, now)]);

  return userId;
}

async function seedCareer(userId: string, now: number): Promise<void> {
  const profile = db.insert(careerProfiles).values({
    id: newId(),
    userId,
    headline: "데이터로 문제를 푸는 기획자를 목표로",
    summary:
      "경영학과 3학년. 교내 학회에서 데이터 분석 프로젝트를 두 번 맡았습니다.",
    desiredRoles: JSON.stringify(["서비스 기획", "데이터 분석"]),
    desiredCompanies: JSON.stringify(["네이버", "토스"]),
    studyField: "business",
    major: "경영학과",
    roleKey: "pm",
    onboardedAt: now,
    updatedAt: now,
  });

  const goal = db.insert(careerGoals).values({
    id: newId(),
    userId,
    type: "ROLE",
    name: "서비스 기획 / PM",
    targetRoles: JSON.stringify(["서비스 기획자", "PM"]),
    targetCompanies: JSON.stringify(["네이버"]),
    targetPeriod: "2027 상반기",
    priority: "HIGH",
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  });

  const skills = [
    "기획",
    "데이터 분석",
    "마케팅",
    "협업",
    "커뮤니케이션",
    "문제 해결",
  ];
  const skillRows = db.insert(userSkills).values(
    skills.map((name) => ({
      id: newId(),
      userId,
      name,
      category:
        name === "데이터 분석"
          ? "tech"
          : name === "기획" || name === "마케팅"
            ? "domain"
            : "soft",
      selfScore: null,
      createdAt: now,
    })),
  );

  const evidence = db.insert(careerEvidence).values([
    {
      id: newId(),
      userId,
      kind: "project",
      title: "교내 상권 데이터 분석 프로젝트",
      description:
        "공공데이터로 상권 매출을 분석해 신규 출점 후보 3곳을 제안했습니다.",
      skills: JSON.stringify(["데이터 분석", "기획"]),
      createdAt: now,
    },
    {
      id: newId(),
      userId,
      kind: "award",
      title: "교내 마케팅 공모전 장려상",
      description: "SNS 캠페인 기획으로 참가 60팀 중 장려상을 받았습니다.",
      skills: JSON.stringify(["마케팅", "협업"]),
      createdAt: now,
    },
  ]);

  // 두 달간의 성장 기록. 이게 없으면 성장 카드가 "내일 다시 오세요"만 보여준다.
  // 항목별로도 올라가게 만들어, 어디서 달라졌는지가 드러나게 한다.
  const trace: Array<[number, number, number, number, number, number]> = [
    // [며칠 전, 총점, 목표 스킬 충족도(55), 실전 경험(15), 검증 가능한 근거(15), 준비 기본기(15)]
    [58, 18, 4, 2, 0, 12],
    [51, 21, 5, 4, 0, 12],
    [44, 24, 6, 4, 2, 12],
    [37, 27, 7, 5, 2, 13],
    [30, 30, 8, 6, 3, 13],
    [23, 31, 8, 7, 3, 13],
    [16, 33, 9, 8, 3, 13],
    [9, 34, 9, 9, 3, 13],
    [2, 35, 7, 10, 3, 15],
  ];
  const snapshots = db.insert(scoreSnapshots).values(
    trace.map(([ago, score, skill, exp, evidenceScore, basics]) => {
      const at = now - ago * 86400000;
      return {
        id: newId(),
        userId,
        day: toDateStr(new Date(at)),
        score,
        breakdown: JSON.stringify([
          { label: "목표 스킬 충족도", points: skill, max: 55, detail: "" },
          { label: "실전 경험", points: exp, max: 15, detail: "" },
          {
            label: "검증 가능한 근거",
            points: evidenceScore,
            max: 15,
            detail: "",
          },
          { label: "준비 기본기", points: basics, max: 15, detail: "" },
        ]),
        createdAt: at,
      };
    }),
  );

  await Promise.all([profile, goal, skillRows, evidence, snapshots]);
}

async function seedActivities(userId: string, now: number): Promise<void> {
  // 1) 마감이 가까운 진행 중 활동 — 대시보드·알림이 살아 있는 것처럼 보이게
  const mainId = newId();
  const activitiesRows = db.insert(activities).values({
    id: mainId,
    userId,
    name: "2026 그린테크 아이디어 공모전",
    organizer: "한국환경산업기술원",
    type: "contest",
    status: "planned",
    importance: "high",
    color: "#2F6BFF",
    applyDeadline: day(4),
    submitDeadline: day(18),
    announceDate: day(32),
    memo: "기획서 초안은 썼고, 심사 기준에 맞춰 다듬는 중",
    createdAt: now,
    updatedAt: now,
  });

  const evaluationCriteriaRows = db.insert(evaluationCriteria).values(
    [
      { name: "창의성", weight: 40, description: "기존과 다른 접근인지" },
      {
        name: "실현 가능성",
        weight: 35,
        description: "기간 안에 만들 수 있는지",
      },
      {
        name: "환경적 효과",
        weight: 25,
        description: "실제로 줄어드는 양이 있는지",
      },
    ].map((c, index) => ({
      id: newId(),
      userId,
      activityId: mainId,
      name: c.name,
      weight: c.weight,
      description: c.description,
      source: "official",
      position: index,
      createdAt: now,
    })),
  );

  const tasksRows = db.insert(tasks).values(
    [
      { title: "기획서 초안 마무리", status: "done", due: day(-2) },
      {
        title: "심사 기준별로 문단 재배치",
        status: "in_progress",
        due: day(2),
      },
      { title: "팀원 피드백 받기", status: "todo", due: day(3) },
    ].map((t) => ({
      id: newId(),
      userId,
      activityId: mainId,
      title: t.title,
      status: t.status,
      dueDate: t.due,
      completedAt: t.status === "done" ? now - 2 * 86400000 : null,
      createdAt: now,
      updatedAt: now,
    })),
  );

  const eventsRows = db.insert(events).values([
    {
      id: newId(),
      userId,
      activityId: mainId,
      title: "접수 마감",
      type: "apply_deadline",
      date: day(4),
      createdAt: now,
    },
    {
      id: newId(),
      userId,
      activityId: mainId,
      title: "발표 심사",
      type: "interview",
      date: day(25),
      createdAt: now,
    },
  ]);

  // 유형이 다른 문항을 둘 넣어야 "문항 은행"이 유형별로 묶인다는 게 보인다
  const essays = [
    {
      question: "팀 프로젝트에서 갈등을 해결한 경험을 서술해주세요.",
      guide: "경험 하나를 골라 상황·역할·행동·결과 순서로",
      answer:
        "학회 프로젝트에서 분석 범위를 두고 의견이 갈렸습니다. 저는 각자 원하는 범위로 하루씩 시험 분석을 돌려보자고 제안했고, 결과를 놓고 다시 이야기해 범위를 좁혔습니다. 덕분에 마감 사흘 전에 초안을 끝냈습니다.",
    },
    {
      question: "지원 동기와 입사 후 이루고 싶은 것을 서술해주세요.",
      guide: "내가 겪은 문제에서 출발해 이 회사여야 하는 이유까지",
      answer:
        "학교 앞 상권이 비어 가는 걸 보며 상권 데이터를 직접 찾아봤고, 그때부터 데이터로 판단을 돕는 일을 하고 싶었습니다.",
    },
  ];
  const questionId = newId();
  const essayIds = essays.map((_, index) =>
    index === 0 ? questionId : newId(),
  );
  const essayQuestionsRows = db.insert(essayQuestions).values(
    essays.map((essay, index) => ({
      id: essayIds[index],
      userId,
      activityId: mainId,
      question: essay.question,
      topic: classifyQuestion(essay.question).topic,
      charLimit: 800,
      guide: essay.guide,
      position: index,
      createdAt: now,
    })),
  );
  const essayDraftsRows = db.insert(essayDrafts).values(
    essays.map((essay, index) => ({
      id: newId(),
      userId,
      questionId: essayIds[index],
      version: 1,
      content: essay.answer,
      score: null,
      createdAt: now,
    })),
  );

  const interviewQuestionsRows = db.insert(interviewQuestions).values(
    [
      {
        q: "이 아이디어를 시작하게 된 계기는 무엇인가요?",
        why: "지원 동기는 첫 질문으로 거의 항상 나옵니다.",
        hint: "내가 겪은 문제에서 출발했다는 점을 한 문장으로",
      },
      {
        q: '"시험 분석을 하루씩 돌려보자고 제안했다"고 쓰셨는데, 그때 기준은 무엇이었나요?',
        why: "지원자가 직접 쓴 문장이라 근거를 확인하려 합니다.",
        hint: "판단 기준을 밝히고 결과까지",
      },
    ].map((item, index) => ({
      id: newId(),
      userId,
      activityId: mainId,
      question: item.q,
      why: item.why,
      hint: item.hint,
      answer:
        index === 0
          ? "학교 앞 카페 폐업을 보고 상권 데이터를 찾아본 게 시작이었습니다."
          : null,
      ready: index === 0 ? 1 : 0,
      source: "ai",
      position: index,
      createdAt: now,
      updatedAt: now,
    })),
  );

  // 1-2) 제출물을 공고의 공식 평가 기준에 맞춰 분석한 결과.
  //      "기준에 맞춰 평가하고 고칠 것을 알려준다"는 두 번째 주장인데,
  //      이게 비어 있으면 둘러보기로는 확인할 수 없다.
  const reviewId = newId();
  const aiReviewsRows = db.insert(aiReviews).values({
    id: reviewId,
    userId,
    activityId: mainId,
    action: "evaluate_submission",
    provider: "demo",
    status: "done",
    overallScore: 71,
    maxScore: 100,
    confidence: 0.62,
    summary:
      "아이디어의 방향은 분명하지만, 심사 기준에서 배점이 가장 큰 창의성과 환경적 효과가 숫자로 뒷받침되지 않았습니다. 기존 사례와 무엇이 다른지, 실제로 줄어드는 양이 얼마인지 두 곳만 채우면 점수가 크게 올라갑니다.",
    resultJson: JSON.stringify({
      overall_score: 71,
      max_score: 100,
      confidence: 0.62,
      summary:
        "아이디어의 방향은 분명하지만, 배점이 큰 두 기준이 숫자로 뒷받침되지 않았습니다.",
      critical_issues: [
        "환경적 효과(25점)에 정량 근거가 전혀 없습니다 — 심사 기준에 '실제로 줄어드는 양'이 명시돼 있습니다.",
      ],
      next_actions: [
        "기존 사례 2개와 비교해 무엇이 다른지 한 문단 추가",
        "예상 절감량을 단위와 함께 제시 (예: 연 기준 kg CO2e)",
        "8주 일정표를 주 단위로 쪼개 실현 가능성 보강",
      ],
      criteria: [
        {
          name: "창의성",
          score: 26,
          max_score: 40,
          source: "official",
          strengths: ["일상에서 겪은 문제에서 출발한 점이 설득력 있습니다."],
          weaknesses: [
            "기존 서비스와의 차이가 '더 편리하다' 수준으로만 서술돼 있습니다.",
          ],
          recommendations: [
            "비슷한 기존 사례 2개를 명시하고 무엇을 다르게 했는지 대조해 쓰기",
          ],
        },
        {
          name: "실현 가능성",
          score: 28,
          max_score: 35,
          source: "official",
          strengths: [
            "필요한 기술이 이미 있는 것들로 구성돼 있습니다.",
            "팀 역할 분담이 구체적입니다.",
          ],
          weaknesses: [
            "8주 일정이 '개발 4주'처럼 크게 묶여 있어 검증이 어렵습니다.",
          ],
          recommendations: ["주 단위로 쪼개고 각 주의 산출물을 한 줄씩 적기"],
        },
        {
          name: "환경적 효과",
          score: 17,
          max_score: 25,
          source: "official",
          strengths: ["효과가 나타나는 경로를 그림으로 설명한 점은 좋습니다."],
          weaknesses: [
            "줄어드는 양이 숫자로 없습니다.",
            "근거 출처가 없습니다.",
          ],
          recommendations: [
            "공공데이터로 추정치를 계산해 단위까지 적기",
            "추정에 쓴 가정을 각주로 남기기",
          ],
        },
      ],
    }),
    createdAt: now - 3_600_000,
    completedAt: now - 3_590_000,
  });
  const aiReviewItemsRows = db.insert(aiReviewItems).values(
    [
      {
        name: "창의성",
        score: 26,
        maxScore: 40,
        strengths: ["일상에서 겪은 문제에서 출발한 점이 설득력 있습니다."],
        weaknesses: [
          "기존 서비스와의 차이가 '더 편리하다' 수준으로만 서술돼 있습니다.",
        ],
        recommendations: [
          "비슷한 기존 사례 2개를 명시하고 무엇을 다르게 했는지 대조해 쓰기",
        ],
      },
      {
        name: "실현 가능성",
        score: 28,
        maxScore: 35,
        strengths: [
          "필요한 기술이 이미 있는 것들로 구성돼 있습니다.",
          "팀 역할 분담이 구체적입니다.",
        ],
        weaknesses: [
          "8주 일정이 '개발 4주'처럼 크게 묶여 있어 검증이 어렵습니다.",
        ],
        recommendations: ["주 단위로 쪼개고 각 주의 산출물을 한 줄씩 적기"],
      },
      {
        name: "환경적 효과",
        score: 17,
        maxScore: 25,
        strengths: ["효과가 나타나는 경로를 그림으로 설명한 점은 좋습니다."],
        weaknesses: ["줄어드는 양이 숫자로 없습니다.", "근거 출처가 없습니다."],
        recommendations: [
          "공공데이터로 추정치를 계산해 단위까지 적기",
          "추정에 쓴 가정을 각주로 남기기",
        ],
      },
    ].map((item, index) => ({
      id: newId(),
      reviewId,
      name: item.name,
      score: item.score,
      maxScore: item.maxScore,
      strengths: JSON.stringify(item.strengths),
      weaknesses: JSON.stringify(item.weaknesses),
      recommendations: JSON.stringify(item.recommendations),
      position: index,
    })),
  );

  // 2) 끝난 활동 — 회고·포트폴리오가 채워진 상태
  const doneId = newId();
  const activitiesRows2 = db.insert(activities).values({
    id: doneId,
    userId,
    name: "제7회 대학생 마케팅 공모전",
    organizer: "한국마케팅협회",
    type: "contest",
    status: "won",
    importance: "medium",
    color: "#F59E0B",
    startDate: day(-120),
    endDate: day(-60),
    role: "팀장 · 캠페인 기획 총괄",
    achievement: "참가 60팀 중 장려상",
    learned:
      "심사 기준을 먼저 읽고 기획서 목차를 맞추는 것이 가장 효과적이었습니다.",
    createdAt: now,
    updatedAt: now,
  });
  const retrospectivesRows = db.insert(retrospectives).values({
    id: newId(),
    userId,
    activityId: doneId,
    situation: "SNS 캠페인 공모전에 4명이 참가했습니다.",
    task: "20대 초반을 겨냥한 캠페인을 2주 안에 기획해야 했습니다.",
    action: "설문 80건을 돌려 메시지를 세 개로 좁히고 A/B로 검증했습니다.",
    result: "장려상을 받았고, 설문 데이터는 다음 프로젝트에도 썼습니다.",
    learned: "심사 기준을 먼저 읽고 목차를 맞추는 것이 가장 효과적이었습니다.",
    createdAt: now,
    updatedAt: now,
  });

  // 3) 관심만 눌러둔 활동
  const activitiesRows3 = db.insert(activities).values({
    id: newId(),
    userId,
    name: "네이버 서비스 기획 인턴",
    organizer: "네이버",
    type: "intern",
    status: "interested",
    importance: "high",
    color: "#22C55E",
    applyDeadline: day(21),
    createdAt: now,
    updatedAt: now,
  });

  // 4) 말려야 하는 기회 — CAVERO 가 "지원하지 마세요"라고 말하는 경우.
  //    둘러보기로 들어온 사람이 이 화면을 보지 못하면 이 서비스의 차이를 알 수 없다.
  const skipId = newId();
  const activitiesRows4 = db.insert(activities).values({
    id: skipId,
    userId,
    name: "제9회 전국 대학생 광고 공모전",
    organizer: "한국광고협회",
    type: "contest",
    status: "interested",
    importance: "low",
    color: "#94A3B8",
    applyDeadline: day(9),
    createdAt: now,
    updatedAt: now,
  });
  const opportunityAnalysesRows = db.insert(opportunityAnalyses).values({
    id: newId(),
    userId,
    activityId: skipId,
    requirements: JSON.stringify({
      summary: "20대를 겨냥한 광고 캠페인 기획안을 제출하는 공모전",
      requiredSkills: ["마케팅", "기획"],
      preferredSkills: [],
      responsibilities: ["캠페인 컨셉 기획", "매체 전략 수립"],
      qualifications: ["전국 대학생", "4인 이내 팀"],
      submissionItems: [
        "기획서",
        "포스터 3종",
        "영상 콘티",
        "발표자료",
        "팀 소개서",
      ],
      keywords: ["광고", "캠페인", "브랜딩"],
    }),
    fitScore: 76,
    fitBreakdown: JSON.stringify({
      breakdown: [
        {
          label: "요구 역량 '마케팅' 보유 — 수상 경력 근거 있음",
          points: 14,
          type: "plus",
        },
        { label: "요구 역량 '기획' 보유", points: 14, type: "plus" },
        { label: "지원 자격 충족", points: 8, type: "plus" },
        {
          label: "목표 직무(서비스 기획)와 요구 역량이 거의 겹치지 않음",
          points: -5,
          type: "warn",
        },
      ],
      strengths: [
        "마케팅 — 이미 같은 분야로 수상한 경험이 있음",
        "기획 — 근거 2건",
      ],
      weaknesses: [
        "목표(서비스 기획)에 새로 채워지는 경험이 거의 없음",
        "제출물 5종으로 준비 부담이 큼",
      ],
    }),
    recommendation: "skip",
    recommendationReason:
      "합격 가능성은 높지만, 준비에 드는 28시간이 목표에 가까워지는 데는 거의 기여하지 않습니다(+0.2). 지금은 다른 행동이 효과적입니다.",
    prepHours: 28,
    gapEffect: 0.2,
    alternative: JSON.stringify({
      title: "서비스 기획 포트폴리오에 문제 정의 1건 추가하기",
      effect: 4,
      minutes: 180,
    }),
    createdAt: now,
  });

  const notificationsRows = db.insert(notifications).values({
    id: newId(),
    userId,
    activityId: mainId,
    type: "schedule",
    title: "D-4 · 2026 그린테크 아이디어 공모전",
    body: "2026 그린테크 아이디어 공모전 — 지원 마감까지 4일 남았습니다.",
    read: 0,
    dedupeKey: `demo:${mainId}:apply:d4`,
    createdAt: now,
  });

  // 서로를 참조하는 값이 없으므로(아이디는 모두 미리 만들었다) 한 번에 보낸다
  await Promise.all([
    activitiesRows,
    evaluationCriteriaRows,
    tasksRows,
    eventsRows,
    essayQuestionsRows,
    essayDraftsRows,
    interviewQuestionsRows,
    aiReviewsRows,
    aiReviewItemsRows,
    activitiesRows2,
    retrospectivesRows,
    activitiesRows3,
    activitiesRows4,
    opportunityAnalysesRows,
    notificationsRows,
  ]);
}

/**
 * 오래된 둘러보기 계정 정리.
 * 임시 계정이 쌓이면 통계도 흐려지고 자료만 늘어난다.
 */
export async function cleanupDemoUsers(now = Date.now()): Promise<number> {
  const stale = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        like(users.email, `%${DEMO_EMAIL_SUFFIX}`),
        lt(users.createdAt, now - DEMO_TTL_MS),
      ),
    );

  for (const user of stale) {
    await deleteDemoUser(user.id);
  }
  return stale.length;
}

async function deleteDemoUser(userId: string): Promise<void> {
  const actIds = (
    await db
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.userId, userId))
  ).map((a) => a.id);
  const reviewIds = (
    await db
      .select({ id: aiReviews.id })
      .from(aiReviews)
      .where(eq(aiReviews.userId, userId))
  ).map((r) => r.id);
  const questionIds = (
    await db
      .select({ id: essayQuestions.id })
      .from(essayQuestions)
      .where(eq(essayQuestions.userId, userId))
  ).map((q) => q.id);

  await Promise.all([
    ...actIds.map((id) =>
      db
        .delete(evaluationCriteria)
        .where(eq(evaluationCriteria.activityId, id)),
    ),
    ...questionIds.map((id) =>
      db.delete(essayDrafts).where(eq(essayDrafts.questionId, id)),
    ),
    // 리뷰 항목은 userId 가 없고 reviewId 로만 매달려 있다
    ...reviewIds.map((id) =>
      db.delete(aiReviewItems).where(eq(aiReviewItems.reviewId, id)),
    ),
  ]);

  await Promise.all([
    db.delete(essayQuestions).where(eq(essayQuestions.userId, userId)),
    db.delete(interviewQuestions).where(eq(interviewQuestions.userId, userId)),
    db.delete(retrospectives).where(eq(retrospectives.userId, userId)),
    db.delete(tasks).where(eq(tasks.userId, userId)),
    db.delete(events).where(eq(events.userId, userId)),
    db.delete(notifications).where(eq(notifications.userId, userId)),
    db.delete(careerEvidence).where(eq(careerEvidence.userId, userId)),
    db.delete(careerGoals).where(eq(careerGoals.userId, userId)),
    db.delete(careerProfiles).where(eq(careerProfiles.userId, userId)),
    db.delete(userSkills).where(eq(userSkills.userId, userId)),
    db
      .delete(opportunityAnalyses)
      .where(eq(opportunityAnalyses.userId, userId)),
    db.delete(scoreSnapshots).where(eq(scoreSnapshots.userId, userId)),
    db.delete(aiReviews).where(eq(aiReviews.userId, userId)),
    db.delete(activities).where(eq(activities.userId, userId)),
    db.delete(sessions).where(eq(sessions.userId, userId)),
  ]);

  await db.delete(users).where(eq(users.id, userId));
}
