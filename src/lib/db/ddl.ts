// PostgreSQL 스키마 부트스트랩 DDL.
// - 로컬(PGlite) 부팅 시 자동 실행되고, Supabase에는 scripts/export-schema.ts 로
//   생성한 schema.sql 을 1회 적용한다.
// - src/lib/db/schema.ts 와 반드시 동기화를 유지할 것.
// - epoch ms 컬럼은 int4 범위를 넘으므로 BIGINT를 사용한다.
export const BOOTSTRAP_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  google_id TEXT,
  avatar_url TEXT,
  calendar_token TEXT,
  terms_agreed_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at BIGINT NOT NULL,
  last_success_at BIGINT,
  failure_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  dashboard_widgets TEXT,
  notify_thresholds TEXT,
  notify_types TEXT,
  quiet_start INTEGER,
  quiet_end INTEGER,
  weekly_report INTEGER NOT NULL DEFAULT 1,
  weekly_day INTEGER NOT NULL DEFAULT 0,
  timezone_offset INTEGER NOT NULL DEFAULT 540,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  organizer TEXT,
  type TEXT NOT NULL DEFAULT 'etc',
  status TEXT NOT NULL DEFAULT 'interested',
  importance TEXT NOT NULL DEFAULT 'medium',
  color TEXT NOT NULL DEFAULT '#6366f1',
  start_date TEXT,
  end_date TEXT,
  apply_deadline TEXT,
  submit_deadline TEXT,
  announce_date TEXT,
  link TEXT,
  contact TEXT,
  memo TEXT,
  ai_summary TEXT,
  role TEXT,
  achievement TEXT,
  learned TEXT,
  skills TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
CREATE TABLE IF NOT EXISTS notice_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  keywords TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_checked_at BIGINT,
  last_error TEXT,
  last_found INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notice_sources_user ON notice_sources(user_id);

CREATE TABLE IF NOT EXISTS notice_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  activity_id TEXT,
  found_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notice_items_user ON notice_items(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notice_items_url ON notice_items(source_id, url);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  used_at BIGINT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_caltoken ON users(calendar_token);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

CREATE TABLE IF NOT EXISTS activity_tags (
  activity_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (activity_id, tag_id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'etc',
  date TEXT NOT NULL,
  time TEXT,
  end_date TEXT,
  memo TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_activity ON events(activity_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'todo',
  position INTEGER NOT NULL DEFAULT 0,
  source_review_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  completed_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_activity ON tasks(activity_id);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'reference',
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  group_id TEXT NOT NULL,
  extracted_text TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_activity ON documents(activity_id);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  due_date TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_activity ON submissions(activity_id);

CREATE TABLE IF NOT EXISTS submission_versions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  is_final INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subver_submission ON submission_versions(submission_id);

CREATE TABLE IF NOT EXISTS retrospectives (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL UNIQUE,
  situation TEXT,
  task TEXT,
  action TEXT,
  result TEXT,
  learned TEXT,
  skills TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_retro_user ON retrospectives(user_id);

CREATE TABLE IF NOT EXISTS essay_questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  question TEXT NOT NULL,
  topic TEXT,
  char_limit INTEGER,
  guide TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_essayq_activity ON essay_questions(activity_id);

CREATE TABLE IF NOT EXISTS essay_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  feedback_json TEXT,
  score DOUBLE PRECISION,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_essayd_question ON essay_drafts(question_id);

CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 0,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_criteria_activity ON evaluation_criteria(activity_id);

CREATE TABLE IF NOT EXISTS ai_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  submission_id TEXT,
  submission_version_id TEXT,
  action TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mock',
  status TEXT NOT NULL DEFAULT 'done',
  overall_score DOUBLE PRECISION,
  max_score DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  summary TEXT,
  result_json TEXT,
  error_message TEXT,
  created_at BIGINT NOT NULL,
  completed_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON ai_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_activity ON ai_reviews(activity_id);

CREATE TABLE IF NOT EXISTS ai_review_items (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  name TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  max_score DOUBLE PRECISION NOT NULL,
  strengths TEXT,
  weaknesses TEXT,
  recommendations TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_review_items_review ON ai_review_items(review_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  dedupe_key TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(dedupe_key);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_activity ON notes(activity_id);

CREATE TABLE IF NOT EXISTS career_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ROLE',
  name TEXT NOT NULL,
  description TEXT,
  target_companies TEXT,
  target_roles TEXT,
  target_period TEXT,
  priority TEXT NOT NULL DEFAULT 'HIGH',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON career_goals(user_id);

CREATE TABLE IF NOT EXISTS user_skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'tech',
  self_score INTEGER,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);

CREATE TABLE IF NOT EXISTS career_evidence (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'etc',
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  skills TEXT,
  source_type TEXT,
  source_id TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_user ON career_evidence(user_id);

CREATE TABLE IF NOT EXISTS career_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  headline TEXT,
  summary TEXT,
  desired_roles TEXT,
  desired_companies TEXT,
  github_username TEXT,
  study_field TEXT,
  major TEXT,
  role_key TEXT,
  onboarded_at BIGINT,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS career_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal_id TEXT,
  skill TEXT,
  title TEXT NOT NULL,
  reason TEXT,
  expected_effect DOUBLE PRECISION NOT NULL DEFAULT 0,
  expected_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'suggested',
  task_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_actions_user ON career_actions(user_id);

CREATE TABLE IF NOT EXISTS roadmap_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal_id TEXT,
  month TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  task_id TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roadmap_user ON roadmap_items(user_id);

CREATE TABLE IF NOT EXISTS score_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  breakdown TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_user ON score_snapshots(user_id);

CREATE TABLE IF NOT EXISTS opportunity_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  requirements TEXT,
  fit_score DOUBLE PRECISION,
  fit_breakdown TEXT,
  recommendation TEXT,
  recommendation_reason TEXT,
  prep_hours DOUBLE PRECISION,
  gap_effect DOUBLE PRECISION,
  alternative TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opp_user ON opportunity_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_opp_activity ON opportunity_analyses(activity_id);

CREATE TABLE IF NOT EXISTS document_blobs (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data BYTEA NOT NULL,
  size INTEGER NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blobs_user ON document_blobs(user_id);

CREATE TABLE IF NOT EXISTS activity_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'updated',
  message TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_activity ON activity_history(activity_id);
`;

/** 앱이 요구하는 테이블 목록 (진단용) */
export const REQUIRED_TABLES = [
  "users",
  "push_subscriptions",
  "user_settings",
  "sessions",
  "activities",
  "tags",
  "activity_tags",
  "events",
  "tasks",
  "documents",
  "submissions",
  "submission_versions",
  "retrospectives",
  "essay_questions",
  "essay_drafts",
  "evaluation_criteria",
  "ai_reviews",
  "ai_review_items",
  "notifications",
  "notes",
  "career_goals",
  "user_skills",
  "career_evidence",
  "career_profiles",
  "career_actions",
  "roadmap_items",
  "score_snapshots",
  "opportunity_analyses",
  "document_blobs",
  "activity_history",
  "password_resets",
  "notice_sources",
  "notice_items",
] as const;

/** 밀리초 시간값이라 BIGINT 여야 하는 컬럼 (진단용) */
export const BIGINT_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["users", "created_at"],
  ["push_subscriptions", "created_at"],
  ["push_subscriptions", "last_success_at"],
  ["sessions", "expires_at"],
  ["activities", "created_at"],
  ["activities", "updated_at"],
  ["events", "created_at"],
  ["tasks", "created_at"],
  ["tasks", "updated_at"],
  ["tasks", "completed_at"],
  ["documents", "created_at"],
  ["submissions", "created_at"],
  ["submissions", "updated_at"],
  ["submission_versions", "created_at"],
  ["retrospectives", "created_at"],
  ["retrospectives", "updated_at"],
  ["essay_questions", "created_at"],
  ["essay_drafts", "created_at"],
  ["ai_reviews", "created_at"],
  ["ai_reviews", "completed_at"],
  ["notifications", "created_at"],
  ["notes", "updated_at"],
  ["career_goals", "created_at"],
  ["career_goals", "updated_at"],
  ["user_skills", "created_at"],
  ["career_evidence", "created_at"],
  ["career_profiles", "onboarded_at"],
  ["career_profiles", "updated_at"],
  ["career_actions", "created_at"],
  ["career_actions", "updated_at"],
  ["roadmap_items", "created_at"],
  ["score_snapshots", "created_at"],
  ["opportunity_analyses", "created_at"],
  ["document_blobs", "created_at"],
  ["activity_history", "created_at"],
] as const;
