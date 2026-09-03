import {
  pgTable,
  text,
  integer,
  bigint,
  doublePrecision,
  primaryKey,
  index,
  customType,
} from "drizzle-orm/pg-core";

/** PostgreSQL bytea (바이너리) 컬럼 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// PostgreSQL(Supabase) 스키마.
// - 날짜(마감일 등)는 "YYYY-MM-DD" text, 생성/수정 시각은 epoch ms.
//   epoch ms는 int4 범위를 넘으므로 반드시 bigint({ mode: "number" }) 를 사용한다.
// - 불리언 성격의 컬럼(read, is_final, is_active)은 0/1 integer로 유지해
//   기존 애플리케이션 로직을 그대로 재사용한다.

/** epoch milliseconds 컬럼 (JS number로 매핑) */
const epochMs = (name: string) => bigint(name, { mode: "number" });

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** 구글 로그인만 쓰는 계정은 비밀번호가 없다 */
  passwordHash: text("password_hash"),
  /** 구글 계정 고유 ID(sub). 이메일이 바뀌어도 유지된다 */
  googleId: text("google_id"),
  avatarUrl: text("avatar_url"),
  /** 캘린더 구독(.ics) 주소에 쓰는 비밀 토큰. 발급 전에는 null */
  calendarToken: text("calendar_token"),
  /** 이용약관·개인정보처리방침에 동의한 시각 */
  termsAgreedAt: epochMs("terms_agreed_at"),
  createdAt: epochMs("created_at").notNull(),
});

/** 비밀번호 재설정 토큰 (메일로 보낸 링크 한 번만 쓰인다) */
export const passwordResets = pgTable(
  "password_resets",
  {
    token: text("token").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: epochMs("expires_at").notNull(),
    usedAt: epochMs("used_at"),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("idx_password_resets_user").on(t.userId)],
);

/** 브라우저 푸시 구독 (기기 하나당 한 줄) */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: epochMs("created_at").notNull(),
    lastSuccessAt: epochMs("last_success_at"),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (t) => [index("idx_push_user").on(t.userId)],
);

/** 사용자별 화면 설정 (대시보드 위젯 등) */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  /** 위젯 키 배열 (JSON). 순서가 곧 표시 순서, 목록에 없으면 숨김 */
  dashboardWidgets: text("dashboard_widgets"),
  updatedAt: epochMs("updated_at").notNull(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: epochMs("expires_at").notNull(),
});

export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    organizer: text("organizer"),
    type: text("type").notNull().default("etc"),
    status: text("status").notNull().default("interested"),
    importance: text("importance").notNull().default("medium"),
    color: text("color").notNull().default("#6366f1"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    applyDeadline: text("apply_deadline"),
    submitDeadline: text("submit_deadline"),
    announceDate: text("announce_date"),
    link: text("link"),
    contact: text("contact"),
    memo: text("memo"),
    // AI 공고 분석 요약 (JSON: AnnouncementSummary)
    aiSummary: text("ai_summary"),
    // 포트폴리오 / 활동 기록 필드
    role: text("role"),
    achievement: text("achievement"),
    learned: text("learned"),
    skills: text("skills"),
    createdAt: epochMs("created_at").notNull(),
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [index("idx_activities_user").on(t.userId)],
);

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
  },
  (t) => [index("idx_tags_user").on(t.userId)],
);

export const activityTags = pgTable(
  "activity_tags",
  {
    activityId: text("activity_id").notNull(),
    tagId: text("tag_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.tagId] })],
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id"),
    title: text("title").notNull(),
    type: text("type").notNull().default("etc"),
    date: text("date").notNull(), // YYYY-MM-DD
    time: text("time"), // HH:mm (선택)
    endDate: text("end_date"),
    memo: text("memo"),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [
    index("idx_events_user").on(t.userId),
    index("idx_events_activity").on(t.activityId),
    index("idx_events_date").on(t.date),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id"),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: text("due_date"),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("todo"),
    position: integer("position").notNull().default(0),
    // AI 리뷰에서 생성된 작업인 경우 원본 리뷰 id
    sourceReviewId: text("source_review_id"),
    createdAt: epochMs("created_at").notNull(),
    updatedAt: epochMs("updated_at").notNull(),
    completedAt: epochMs("completed_at"),
  },
  (t) => [
    index("idx_tasks_user").on(t.userId),
    index("idx_tasks_activity").on(t.activityId),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    category: text("category").notNull().default("reference"),
    name: text("name").notNull(),
    originalName: text("original_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    storagePath: text("storage_path").notNull(),
    description: text("description"),
    version: integer("version").notNull().default(1),
    // 같은 문서의 버전들을 묶는 그룹 id (첫 버전의 문서 id)
    groupId: text("group_id").notNull(),
    // 텍스트 추출 캐시
    extractedText: text("extracted_text"),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [
    index("idx_documents_user").on(t.userId),
    index("idx_documents_activity").on(t.activityId),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    dueDate: text("due_date"),
    createdAt: epochMs("created_at").notNull(),
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [
    index("idx_submissions_user").on(t.userId),
    index("idx_submissions_activity").on(t.activityId),
  ],
);

export const submissionVersions = pgTable(
  "submission_versions",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull(),
    documentId: text("document_id").notNull(),
    versionLabel: text("version_label").notNull(), // v1, v2, ..., Final
    isFinal: integer("is_final").notNull().default(0),
    note: text("note"),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("idx_subver_submission").on(t.submissionId)],
);

/** 자기소개서 문항 (지원서 항목 단위) */
/** 활동 회고 (STAR). 자소서 재료이자 스킬 근거가 된다 */
export const retrospectives = pgTable(
  "retrospectives",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull().unique(),
    situation: text("situation"),
    task: text("task"),
    action: text("action"),
    result: text("result"),
    learned: text("learned"),
    /** 이 활동으로 증명한 스킬 (JSON string[]) */
    skills: text("skills"),
    createdAt: epochMs("created_at").notNull(),
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [index("idx_retro_user").on(t.userId)],
);

export const essayQuestions = pgTable(
  "essay_questions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    question: text("question").notNull(),
    /** 글자수 제한 (없으면 null) */
    charLimit: integer("char_limit"),
    guide: text("guide"),
    position: integer("position").notNull().default(0),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("idx_essayq_activity").on(t.activityId)],
);

/** 문항별 답변 초안 (버전별로 쌓인다) */
export const essayDrafts = pgTable(
  "essay_drafts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    questionId: text("question_id").notNull(),
    version: integer("version").notNull().default(1),
    content: text("content").notNull(),
    /** AI 코칭 결과 (JSON) */
    feedbackJson: text("feedback_json"),
    score: doublePrecision("score"),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("idx_essayd_question").on(t.questionId)],
);

export const evaluationCriteria = pgTable(
  "evaluation_criteria",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    name: text("name").notNull(),
    weight: doublePrecision("weight").notNull().default(0), // 배점
    description: text("description"),
    source: text("source").notNull().default("manual"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("idx_criteria_activity").on(t.activityId)],
);

export const aiReviews = pgTable(
  "ai_reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    submissionId: text("submission_id"),
    submissionVersionId: text("submission_version_id"),
    action: text("action").notNull(),
    provider: text("provider").notNull().default("mock"),
    status: text("status").notNull().default("done"), // pending | running | done | error
    overallScore: doublePrecision("overall_score"),
    maxScore: doublePrecision("max_score"),
    confidence: doublePrecision("confidence"),
    summary: text("summary"),
    // AI 응답 전체 (JSON)
    resultJson: text("result_json"),
    errorMessage: text("error_message"),
    createdAt: epochMs("created_at").notNull(),
    completedAt: epochMs("completed_at"),
  },
  (t) => [
    index("idx_reviews_user").on(t.userId),
    index("idx_reviews_activity").on(t.activityId),
  ],
);

export const aiReviewItems = pgTable(
  "ai_review_items",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id").notNull(),
    name: text("name").notNull(),
    score: doublePrecision("score").notNull(),
    maxScore: doublePrecision("max_score").notNull(),
    strengths: text("strengths"), // JSON string[]
    weaknesses: text("weaknesses"), // JSON string[]
    recommendations: text("recommendations"), // JSON string[]
    position: integer("position").notNull().default(0),
  },
  (t) => [index("idx_review_items_review").on(t.reviewId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id"),
    type: text("type").notNull().default("system"),
    title: text("title").notNull(),
    body: text("body"),
    // D-day 알림 중복 생성 방지용 키 (예: "event:<id>:d3")
    dedupeKey: text("dedupe_key"),
    read: integer("read").notNull().default(0),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [
    index("idx_notifications_user").on(t.userId),
    index("idx_notifications_dedupe").on(t.dedupeKey),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    content: text("content").notNull().default(""),
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [index("idx_notes_activity").on(t.activityId)],
);

export const activityHistory = pgTable(
  "activity_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    kind: text("kind").notNull().default("updated"),
    message: text("message").notNull(),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("idx_history_activity").on(t.activityId)],
);

// ─── Career OS 도메인 ────────────────────────────────────────
// 스킬 카탈로그는 코드 상수(SKILL_CATALOG)로 관리하고,
// 사용자가 보유한 스킬만 user_skills에 저장한다.

export const careerGoals = pgTable(
  "career_goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull().default("ROLE"), // ROLE | COMPANY | INDUSTRY | GENERAL
    name: text("name").notNull(),
    description: text("description"),
    targetCompanies: text("target_companies"), // JSON string[]
    targetRoles: text("target_roles"), // JSON string[]
    targetPeriod: text("target_period"),
    priority: text("priority").notNull().default("HIGH"),
    isActive: integer("is_active").notNull().default(1),
    createdAt: epochMs("created_at").notNull(),
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [index("idx_goals_user").on(t.userId)],
);

export const userSkills = pgTable(
  "user_skills",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("tech"),
    // 자가 평가(0~100). 근거가 아니라 낮은 신뢰도의 참고값으로만 취급한다.
    selfScore: integer("self_score"),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("idx_user_skills_user").on(t.userId)],
);

export const careerEvidence = pgTable(
  "career_evidence",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull().default("etc"),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url"),
    skills: text("skills"), // JSON string[] (스킬명)
    sourceType: text("source_type"), // activity | manual | github | task
    sourceId: text("source_id"),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("idx_evidence_user").on(t.userId)],
);

export const careerProfiles = pgTable("career_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  headline: text("headline"), // 예: "Software × AI"
  summary: text("summary"),
  desiredRoles: text("desired_roles"), // JSON string[]
  desiredCompanies: text("desired_companies"), // JSON string[]
  githubUsername: text("github_username"),
  studyField: text("study_field"), // STUDY_FIELDS 키 (인문·상경·공학 …)
  major: text("major"), // 학과/학부 (자유 입력)
  roleKey: text("role_key"), // ROLE_TEMPLATES 키 — 희망 직무를 직접 고른 경우
  onboardedAt: epochMs("onboarded_at"),
  updatedAt: epochMs("updated_at").notNull(),
});

export const careerActions = pgTable(
  "career_actions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    goalId: text("goal_id"),
    skill: text("skill"),
    title: text("title").notNull(),
    reason: text("reason"),
    expectedEffect: doublePrecision("expected_effect").notNull().default(0),
    expectedMinutes: integer("expected_minutes").notNull().default(60),
    status: text("status").notNull().default("suggested"), // suggested | accepted | done | dismissed
    taskId: text("task_id"),
    createdAt: epochMs("created_at").notNull(),
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [index("idx_actions_user").on(t.userId)],
);

export const roadmapItems = pgTable(
  "roadmap_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    goalId: text("goal_id"),
    month: text("month").notNull(), // YYYY-MM
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("planned"),
    taskId: text("task_id"),
    position: integer("position").notNull().default(0),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("idx_roadmap_user").on(t.userId)],
);

export const scoreSnapshots = pgTable(
  "score_snapshots",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    score: doublePrecision("score").notNull(),
    breakdown: text("breakdown"), // JSON
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("idx_snapshots_user").on(t.userId)],
);

export const opportunityAnalyses = pgTable(
  "opportunity_analyses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    // AI가 추출한 요구사항 (OpportunityRequirements JSON)
    requirements: text("requirements"),
    fitScore: doublePrecision("fit_score"),
    fitBreakdown: text("fit_breakdown"), // JSON: 근거 항목 배열
    recommendation: text("recommendation"), // apply | hold | skip
    recommendationReason: text("recommendation_reason"),
    prepHours: doublePrecision("prep_hours"),
    gapEffect: doublePrecision("gap_effect"),
    alternative: text("alternative"), // JSON: 대안 행동
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [
    index("idx_opp_user").on(t.userId),
    index("idx_opp_activity").on(t.activityId),
  ],
);

/**
 * 업로드 파일 본문 저장소 (기본 백엔드).
 * R2/Supabase Storage 같은 외부 오브젝트 스토리지를 설정하지 않아도
 * 추가 서비스 없이 파일 업로드가 동작하도록 DB에 바이너리를 보관한다.
 * key 는 storage.ts 가 생성한 안전한 경로(`<userId>/<uuid>.<ext>`).
 */
export const documentBlobs = pgTable("document_blobs", {
  key: text("key").primaryKey(),
  userId: text("user_id").notNull(),
  data: bytea("data").notNull(),
  size: integer("size").notNull(),
  createdAt: epochMs("created_at").notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
export type TagRow = typeof tags.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type SubmissionVersionRow = typeof submissionVersions.$inferSelect;
export type CriteriaRow = typeof evaluationCriteria.$inferSelect;
export type AIReviewRow = typeof aiReviews.$inferSelect;
export type AIReviewItemRow = typeof aiReviewItems.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
export type HistoryRow = typeof activityHistory.$inferSelect;
export type CareerGoalRow = typeof careerGoals.$inferSelect;
export type UserSkillRow = typeof userSkills.$inferSelect;
export type EvidenceRow = typeof careerEvidence.$inferSelect;
export type CareerProfileRow = typeof careerProfiles.$inferSelect;
export type CareerActionRow = typeof careerActions.$inferSelect;
export type RoadmapItemRow = typeof roadmapItems.$inferSelect;
export type ScoreSnapshotRow = typeof scoreSnapshots.$inferSelect;
export type OpportunityAnalysisRow = typeof opportunityAnalyses.$inferSelect;
export type DocumentBlobRow = typeof documentBlobs.$inferSelect;
