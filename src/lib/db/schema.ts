import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";

// 모든 날짜(마감일 등)는 "YYYY-MM-DD" 텍스트, 생성/수정 시각은 epoch ms 정수로 저장.
// PostgreSQL(Supabase) 전환 시 이 스키마 파일과 부트스트랩 DDL만 교체하면 된다.

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const activities = sqliteTable(
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
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("idx_activities_user").on(t.userId)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
  },
  (t) => [index("idx_tags_user").on(t.userId)],
);

export const activityTags = sqliteTable(
  "activity_tags",
  {
    activityId: text("activity_id").notNull(),
    tagId: text("tag_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.tagId] })],
);

export const events = sqliteTable(
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
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_events_user").on(t.userId),
    index("idx_events_activity").on(t.activityId),
    index("idx_events_date").on(t.date),
  ],
);

export const tasks = sqliteTable(
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
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    completedAt: integer("completed_at"),
  },
  (t) => [
    index("idx_tasks_user").on(t.userId),
    index("idx_tasks_activity").on(t.activityId),
  ],
);

export const documents = sqliteTable(
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
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_documents_user").on(t.userId),
    index("idx_documents_activity").on(t.activityId),
  ],
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    dueDate: text("due_date"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("idx_submissions_user").on(t.userId),
    index("idx_submissions_activity").on(t.activityId),
  ],
);

export const submissionVersions = sqliteTable(
  "submission_versions",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull(),
    documentId: text("document_id").notNull(),
    versionLabel: text("version_label").notNull(), // v1, v2, ..., Final
    isFinal: integer("is_final").notNull().default(0),
    note: text("note"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_subver_submission").on(t.submissionId)],
);

export const evaluationCriteria = sqliteTable(
  "evaluation_criteria",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    name: text("name").notNull(),
    weight: real("weight").notNull().default(0), // 배점
    description: text("description"),
    source: text("source").notNull().default("manual"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("idx_criteria_activity").on(t.activityId)],
);

export const aiReviews = sqliteTable(
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
    overallScore: real("overall_score"),
    maxScore: real("max_score"),
    confidence: real("confidence"),
    summary: text("summary"),
    // AI 응답 전체 (JSON)
    resultJson: text("result_json"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at").notNull(),
    completedAt: integer("completed_at"),
  },
  (t) => [
    index("idx_reviews_user").on(t.userId),
    index("idx_reviews_activity").on(t.activityId),
  ],
);

export const aiReviewItems = sqliteTable(
  "ai_review_items",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id").notNull(),
    name: text("name").notNull(),
    score: real("score").notNull(),
    maxScore: real("max_score").notNull(),
    strengths: text("strengths"), // JSON string[]
    weaknesses: text("weaknesses"), // JSON string[]
    recommendations: text("recommendations"), // JSON string[]
    position: integer("position").notNull().default(0),
  },
  (t) => [index("idx_review_items_review").on(t.reviewId)],
);

export const notifications = sqliteTable(
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
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_notifications_user").on(t.userId),
    index("idx_notifications_dedupe").on(t.dedupeKey),
  ],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    content: text("content").notNull().default(""),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("idx_notes_activity").on(t.activityId)],
);

export const activityHistory = sqliteTable(
  "activity_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    kind: text("kind").notNull().default("updated"),
    message: text("message").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_history_activity").on(t.activityId)],
);

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
