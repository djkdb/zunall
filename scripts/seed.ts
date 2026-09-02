/**
 * 데모 데이터 시드 스크립트 (PostgreSQL).
 * 실행: npm run seed
 * 계정: demo@cavero.app / demo1234!
 *
 * DATABASE_URL 이 있으면 해당 Postgres(Supabase 등), 없으면 로컬 PGlite에 넣는다.
 */
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  users,
  activities,
  tags,
  activityTags,
  events,
  tasks,
  evaluationCriteria,
  submissions,
  activityHistory,
} from "../src/lib/db";

const id = () => randomUUID().replace(/-/g, "").slice(0, 20);
const now = Date.now();
const day = 86400000;
const dateStr = (offsetDays: number) => {
  const d = new Date(now + offsetDays * day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

interface SeedActivity {
  name: string;
  organizer: string;
  type: string;
  status: string;
  importance: string;
  color: string;
  applyDeadline?: string;
  submitDeadline?: string;
  announceDate?: string;
  startDate?: string;
  endDate?: string;
  memo?: string;
  tags: string[];
}

const seedActivities: SeedActivity[] = [
  {
    name: "네이버 AI 디깅클럽 3기",
    organizer: "네이버",
    type: "supporters",
    status: "active",
    importance: "high",
    color: "#10b981",
    startDate: dateStr(-30),
    endDate: dateStr(40),
    submitDeadline: dateStr(3),
    announceDate: dateStr(20),
    memo: "월 1회 콘텐츠 제출. 이번 달 주제: 생성형 AI 활용 사례",
    tags: ["AI", "네이버", "콘텐츠"],
  },
  {
    name: "2026 데이터 분석 공모전",
    organizer: "한국데이터산업진흥원",
    type: "contest",
    status: "applied",
    importance: "high",
    color: "#6366f1",
    applyDeadline: dateStr(-5),
    submitDeadline: dateStr(14),
    announceDate: dateStr(35),
    memo: "공공데이터 활용 트랙으로 지원함",
    tags: ["데이터", "공모전", "수상도전"],
  },
  {
    name: "캠퍼스 해커톤 시즌2",
    organizer: "스타트업얼라이언스",
    type: "hackathon",
    status: "planned",
    importance: "medium",
    color: "#f59e0b",
    applyDeadline: dateStr(7),
    startDate: dateStr(21),
    endDate: dateStr(23),
    memo: "팀원 2명 더 구해야 함",
    tags: ["해커톤", "개발"],
  },
  {
    name: "대학생 마케팅 서포터즈",
    organizer: "오뚜기",
    type: "supporters",
    status: "won",
    importance: "medium",
    color: "#ec4899",
    startDate: dateStr(-120),
    endDate: dateStr(-30),
    memo: "우수 활동자 선정!",
    tags: ["마케팅", "포트폴리오"],
  },
  {
    name: "UX 리서치 부트캠프",
    organizer: "패스트캠퍼스",
    type: "education",
    status: "done",
    importance: "low",
    color: "#8b5cf6",
    startDate: dateStr(-90),
    endDate: dateStr(-50),
    tags: ["UX", "교육"],
  },
];

async function main() {
  const existing = (
    await db.select({ id: users.id }).from(users).where(eq(users.email, "demo@cavero.app")).limit(1)
  )[0];
  if (existing) {
    console.log("데모 계정이 이미 존재합니다. (demo@cavero.app)");
    return;
  }

  const userId = id();
  await db.insert(users).values({
    id: userId,
    email: "demo@cavero.app",
    name: "김준하",
    passwordHash: hashPassword("demo1234!"),
    createdAt: now,
  });

  const tagIds = new Map<string, string>();
  async function tagId(name: string): Promise<string> {
    let found = tagIds.get(name);
    if (!found) {
      found = id();
      await db.insert(tags).values({ id: found, userId, name });
      tagIds.set(name, found);
    }
    return found;
  }

  const activityIds: string[] = [];
  for (const [index, act] of seedActivities.entries()) {
    const actId = id();
    activityIds.push(actId);
    await db.insert(activities).values({
      id: actId,
      userId,
      name: act.name,
      organizer: act.organizer,
      type: act.type,
      status: act.status,
      importance: act.importance,
      color: act.color,
      startDate: act.startDate ?? null,
      endDate: act.endDate ?? null,
      applyDeadline: act.applyDeadline ?? null,
      submitDeadline: act.submitDeadline ?? null,
      announceDate: act.announceDate ?? null,
      memo: act.memo ?? null,
      createdAt: now - (seedActivities.length - index) * day * 7,
      updatedAt: now - index * day,
    });

    for (const tag of act.tags) {
      await db.insert(activityTags).values({ activityId: actId, tagId: await tagId(tag) });
    }
    await db.insert(activityHistory).values({
      id: id(),
      userId,
      activityId: actId,
      kind: "created",
      message: `활동 "${act.name}" 생성`,
      createdAt: now - (seedActivities.length - index) * day * 7,
    });

    const pairs: Array<[string | undefined, string, string]> = [
      [act.applyDeadline, "apply_deadline", "지원 마감"],
      [act.submitDeadline, "final_submit", "최종 제출"],
      [act.announceDate, "result", "결과 발표"],
    ];
    for (const [date, type, label] of pairs) {
      if (!date) continue;
      await db.insert(events).values({
        id: id(),
        userId,
        activityId: actId,
        title: `${act.name} ${label}`,
        type,
        date,
        createdAt: now,
      });
    }
  }

  // 디깅클럽: 일정 + 작업 + 제출물
  const digging = activityIds[0];
  await db.insert(events).values({
    id: id(),
    userId,
    activityId: digging,
    title: "월간 온라인 미팅",
    type: "education",
    date: dateStr(1),
    time: "19:00",
    memo: "줌 링크는 슬랙 공지 확인",
    createdAt: now,
  });

  const diggingTasks: Array<[string, string | null, string, string, string]> = [
    ["이번 달 콘텐츠 주제 정리", "생성형 AI 활용 사례 3개 조사", dateStr(0), "high", "in_progress"],
    ["초안 작성", null, dateStr(1), "high", "todo"],
    ["결과물 검토 및 제출", "제출 전 AI 최종 검토 실행하기", dateStr(3), "urgent", "todo"],
    ["지난 달 피드백 반영", null, dateStr(-3), "medium", "done"],
  ];
  for (const [i, [title, desc, due, priority, status]] of diggingTasks.entries()) {
    await db.insert(tasks).values({
      id: id(),
      userId,
      activityId: digging,
      title,
      description: desc,
      dueDate: due,
      priority,
      status,
      position: i + 1,
      createdAt: now - day,
      updatedAt: now,
      completedAt: status === "done" ? now - day : null,
    });
  }
  await db.insert(submissions).values({
    id: id(),
    userId,
    activityId: digging,
    title: "9월 콘텐츠 원고",
    description: "블로그 게시용 원고 (이미지 3장 포함)",
    status: "draft",
    dueDate: dateStr(3),
    createdAt: now - day * 2,
    updatedAt: now,
  });

  // 데이터 공모전: 평가 기준 + 작업 + 제출물
  const contest = activityIds[1];
  const criteria: Array<[string, number, string]> = [
    ["문제 정의", 20, "해결하려는 문제의 명확성과 사회적 가치"],
    ["분석 방법론", 30, "데이터 처리와 분석 기법의 적절성"],
    ["인사이트", 30, "도출된 인사이트의 독창성과 실용성"],
    ["시각화·전달력", 20, "결과물의 완성도와 전달력"],
  ];
  for (const [i, [name, weight, description]] of criteria.entries()) {
    await db.insert(evaluationCriteria).values({
      id: id(),
      userId,
      activityId: contest,
      name,
      weight,
      description,
      source: "official",
      position: i,
    });
  }

  const contestTasks: Array<[string, string | null, string, string, string]> = [
    ["공공데이터 수집", null, dateStr(-2), "high", "done"],
    ["EDA 및 전처리", null, dateStr(2), "high", "in_progress"],
    ["분석 보고서 작성", "평가 기준의 배점 순서대로 섹션 구성", dateStr(8), "urgent", "todo"],
    ["시각화 대시보드 제작", null, dateStr(10), "medium", "todo"],
  ];
  for (const [i, [title, desc, due, priority, status]] of contestTasks.entries()) {
    await db.insert(tasks).values({
      id: id(),
      userId,
      activityId: contest,
      title,
      description: desc,
      dueDate: due,
      priority,
      status,
      position: i + 10,
      createdAt: now - day * 3,
      updatedAt: now,
      completedAt: status === "done" ? now - day * 2 : null,
    });
  }
  await db.insert(submissions).values({
    id: id(),
    userId,
    activityId: contest,
    title: "분석 보고서",
    description: "PDF 20페이지 이내, 10MB 이하",
    status: "draft",
    dueDate: dateStr(14),
    createdAt: now - day,
    updatedAt: now,
  });
  await db.insert(activityHistory).values({
    id: id(),
    userId,
    activityId: contest,
    kind: "status",
    message: "상태 변경: 지원 예정 → 지원 완료",
    createdAt: now - day * 4,
  });

  // 해커톤 작업
  await db.insert(tasks).values({
    id: id(),
    userId,
    activityId: activityIds[2],
    title: "팀원 모집 글 올리기",
    description: "교내 커뮤니티 + 디스코드",
    dueDate: dateStr(2),
    priority: "high",
    status: "todo",
    position: 20,
    createdAt: now,
    updatedAt: now,
  });

  console.log("✅ 시드 완료");
  console.log("   계정: demo@cavero.app / demo1234!");
  console.log(`   활동 ${seedActivities.length}개, 데모 일정/작업/평가기준 생성됨`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("시드 실패:", error);
    process.exit(1);
  });
