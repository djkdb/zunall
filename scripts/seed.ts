/**
 * 데모 데이터 시드 스크립트.
 * 실행: npm run seed
 * 계정: demo@zunall.app / demo1234!
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { BOOTSTRAP_DDL } from "../src/lib/db/ddl";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "zunall.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(BOOTSTRAP_DDL);

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

// 이미 시드된 경우 중복 방지
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get("demo@zunall.app") as
  | { id: string }
  | undefined;
if (existing) {
  console.log("데모 계정이 이미 존재합니다. (demo@zunall.app)");
  process.exit(0);
}

const userId = id();
db.prepare(
  "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
).run(userId, "demo@zunall.app", "김준하", hashPassword("demo1234!"), now);

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

const insertActivity = db.prepare(`
  INSERT INTO activities (id, user_id, name, organizer, type, status, importance, color,
    start_date, end_date, apply_deadline, submit_deadline, announce_date, memo, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertTag = db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)");
const insertActivityTag = db.prepare(
  "INSERT INTO activity_tags (activity_id, tag_id) VALUES (?, ?)",
);
const insertEvent = db.prepare(`
  INSERT INTO events (id, user_id, activity_id, title, type, date, time, memo, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertTask = db.prepare(`
  INSERT INTO tasks (id, user_id, activity_id, title, description, due_date, priority, status, position, created_at, updated_at, completed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertCriterion = db.prepare(`
  INSERT INTO evaluation_criteria (id, user_id, activity_id, name, weight, description, source, position)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertHistory = db.prepare(`
  INSERT INTO activity_history (id, user_id, activity_id, kind, message, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertSubmission = db.prepare(`
  INSERT INTO submissions (id, user_id, activity_id, title, description, status, due_date, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const tagIds = new Map<string, string>();
function tagId(name: string): string {
  let existing = tagIds.get(name);
  if (!existing) {
    existing = id();
    insertTag.run(existing, userId, name);
    tagIds.set(name, existing);
  }
  return existing;
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

const activityIds: string[] = [];
for (const [index, act] of seedActivities.entries()) {
  const actId = id();
  activityIds.push(actId);
  insertActivity.run(
    actId,
    userId,
    act.name,
    act.organizer,
    act.type,
    act.status,
    act.importance,
    act.color,
    act.startDate ?? null,
    act.endDate ?? null,
    act.applyDeadline ?? null,
    act.submitDeadline ?? null,
    act.announceDate ?? null,
    act.memo ?? null,
    now - (seedActivities.length - index) * day * 7,
    now - index * day,
  );
  for (const tag of act.tags) {
    insertActivityTag.run(actId, tagId(tag));
  }
  insertHistory.run(id(), userId, actId, "created", `활동 "${act.name}" 생성`, now - (seedActivities.length - index) * day * 7);

  if (act.applyDeadline) {
    insertEvent.run(id(), userId, actId, `${act.name} 지원 마감`, "apply_deadline", act.applyDeadline, null, null, now);
  }
  if (act.submitDeadline) {
    insertEvent.run(id(), userId, actId, `${act.name} 최종 제출`, "final_submit", act.submitDeadline, null, null, now);
  }
  if (act.announceDate) {
    insertEvent.run(id(), userId, actId, `${act.name} 결과 발표`, "result", act.announceDate, null, null, now);
  }
}

// 디깅클럽: 작업 + 제출물
const digging = activityIds[0];
insertEvent.run(id(), userId, digging, "월간 온라인 미팅", "education", dateStr(1), "19:00", "줌 링크는 슬랙 공지 확인", now);
const diggingTasks: Array<[string, string, string | null, string, string]> = [
  ["이번 달 콘텐츠 주제 정리", "생성형 AI 활용 사례 3개 조사", dateStr(0), "high", "in_progress"],
  ["초안 작성", null as unknown as string, dateStr(1), "high", "todo"],
  ["결과물 검토 및 제출", "제출 전 AI 최종 검토 실행하기", dateStr(3), "urgent", "todo"],
  ["지난 달 피드백 반영", null as unknown as string, dateStr(-3), "medium", "done"],
];
diggingTasks.forEach(([title, desc, due, priority, status], i) => {
  insertTask.run(
    id(), userId, digging, title, desc ?? null, due, priority, status, i + 1,
    now - day, now, status === "done" ? now - day : null,
  );
});
insertSubmission.run(
  id(), userId, digging, "9월 콘텐츠 원고", "블로그 게시용 원고 (이미지 3장 포함)", "draft", dateStr(3), now - day * 2, now,
);

// 데이터 공모전: 평가 기준 + 작업 + 제출물
const contest = activityIds[1];
const criteria: Array<[string, number, string]> = [
  ["문제 정의", 20, "해결하려는 문제의 명확성과 사회적 가치"],
  ["분석 방법론", 30, "데이터 처리와 분석 기법의 적절성"],
  ["인사이트", 30, "도출된 인사이트의 독창성과 실용성"],
  ["시각화·전달력", 20, "결과물의 완성도와 전달력"],
];
criteria.forEach(([name, weight, desc], i) => {
  insertCriterion.run(id(), userId, contest, name, weight, desc, "official", i);
});
const contestTasks: Array<[string, string | null, string, string, string]> = [
  ["공공데이터 수집", null, dateStr(-2), "high", "done"],
  ["EDA 및 전처리", null, dateStr(2), "high", "in_progress"],
  ["분석 보고서 작성", "평가 기준의 배점 순서대로 섹션 구성", dateStr(8), "urgent", "todo"],
  ["시각화 대시보드 제작", null, dateStr(10), "medium", "todo"],
];
contestTasks.forEach(([title, desc, due, priority, status], i) => {
  insertTask.run(
    id(), userId, contest, title, desc, due, priority, status, i + 10,
    now - day * 3, now, status === "done" ? now - day * 2 : null,
  );
});
insertSubmission.run(
  id(), userId, contest, "분석 보고서", "PDF 20페이지 이내, 10MB 이하", "draft", dateStr(14), now - day, now,
);
insertHistory.run(id(), userId, contest, "status", "상태 변경: 지원 예정 → 지원 완료", now - day * 4);

// 해커톤 작업
insertTask.run(
  id(), userId, activityIds[2], "팀원 모집 글 올리기", "교내 커뮤니티 + 디스코드", dateStr(2), "high", "todo", 20, now, now, null,
);

console.log("✅ 시드 완료");
console.log("   계정: demo@zunall.app / demo1234!");
console.log(`   활동 ${seedActivities.length}개, 데모 일정/작업/평가기준 생성됨`);
