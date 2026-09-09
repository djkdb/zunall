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

  await Promise.all([profile, goal, skillRows, evidence]);
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
    activitiesRows2,
    retrospectivesRows,
    activitiesRows3,
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
    db.delete(activities).where(eq(activities.userId, userId)),
    db.delete(sessions).where(eq(sessions.userId, userId)),
  ]);

  await db.delete(users).where(eq(users.id, userId));
}
