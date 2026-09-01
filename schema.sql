-- Zunall schema (generated from src/lib/db/ddl.ts)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
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
