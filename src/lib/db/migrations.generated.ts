// 이 파일은 scripts/gen-migrations.ts 가 만든다. 직접 고치지 말 것.
// migrations/*.sql 을 수정한 뒤 `npm run gen:migrations` 를 실행하세요.

export interface BundledMigration {
  name: string;
  sql: string;
}

/** 번호 순서대로 한 번씩 적용된다 (모두 재실행 안전하게 작성되어 있다) */
export const MIGRATIONS: BundledMigration[] = [
  {
    name: "001-google-login.sql",
    sql: "-- 이미 배포된 DB에 구글 로그인 컬럼을 추가한다.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;\nALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;\nALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;\nCREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_id);\n",
  },
  {
    name: "002-calendar-token.sql",
    sql: "-- 캘린더 구독(.ics) 주소용 토큰 컬럼.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_token TEXT;\nCREATE UNIQUE INDEX IF NOT EXISTS idx_users_caltoken ON users(calendar_token);\n",
  },
  {
    name: "003-push-subscriptions.sql",
    sql: "-- 브라우저 푸시 알림 구독 테이블.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nCREATE TABLE IF NOT EXISTS push_subscriptions (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  endpoint TEXT NOT NULL UNIQUE,\n  p256dh TEXT NOT NULL,\n  auth TEXT NOT NULL,\n  user_agent TEXT,\n  created_at BIGINT NOT NULL,\n  last_success_at BIGINT,\n  failure_count INTEGER NOT NULL DEFAULT 0\n);\nCREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);\n",
  },
  {
    name: "004-essay-coach.sql",
    sql: "-- 자기소개서 문항별 코칭 테이블.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nCREATE TABLE IF NOT EXISTS essay_questions (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  activity_id TEXT NOT NULL,\n  question TEXT NOT NULL,\n  char_limit INTEGER,\n  guide TEXT,\n  position INTEGER NOT NULL DEFAULT 0,\n  created_at BIGINT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_essayq_activity ON essay_questions(activity_id);\n\nCREATE TABLE IF NOT EXISTS essay_drafts (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  question_id TEXT NOT NULL,\n  version INTEGER NOT NULL DEFAULT 1,\n  content TEXT NOT NULL,\n  feedback_json TEXT,\n  score DOUBLE PRECISION,\n  created_at BIGINT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_essayd_question ON essay_drafts(question_id);\n",
  },
  {
    name: "005-retrospectives.sql",
    sql: "-- 활동 회고(STAR) 테이블.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nCREATE TABLE IF NOT EXISTS retrospectives (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  activity_id TEXT NOT NULL UNIQUE,\n  situation TEXT,\n  task TEXT,\n  action TEXT,\n  result TEXT,\n  learned TEXT,\n  skills TEXT,\n  created_at BIGINT NOT NULL,\n  updated_at BIGINT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_retro_user ON retrospectives(user_id);\n",
  },
  {
    name: "006-bigint-epoch.sql",
    sql: "-- 시간 컬럼(밀리초)을 BIGINT 로 맞춘다.\n-- 예전 버전 schema.sql 로 만든 DB 는 이 컬럼들이 INTEGER 라서\n-- \"value ... is out of range for type integer\" 오류가 난다.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nALTER TABLE users ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE push_subscriptions ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE push_subscriptions ALTER COLUMN last_success_at TYPE BIGINT;\nALTER TABLE sessions ALTER COLUMN expires_at TYPE BIGINT;\nALTER TABLE activities ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE activities ALTER COLUMN updated_at TYPE BIGINT;\nALTER TABLE events ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE tasks ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE tasks ALTER COLUMN updated_at TYPE BIGINT;\nALTER TABLE tasks ALTER COLUMN completed_at TYPE BIGINT;\nALTER TABLE documents ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE submissions ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE submissions ALTER COLUMN updated_at TYPE BIGINT;\nALTER TABLE submission_versions ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE retrospectives ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE retrospectives ALTER COLUMN updated_at TYPE BIGINT;\nALTER TABLE essay_questions ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE essay_drafts ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE ai_reviews ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE ai_reviews ALTER COLUMN completed_at TYPE BIGINT;\nALTER TABLE notifications ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE notes ALTER COLUMN updated_at TYPE BIGINT;\nALTER TABLE career_goals ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE career_goals ALTER COLUMN updated_at TYPE BIGINT;\nALTER TABLE user_skills ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE career_evidence ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE career_profiles ALTER COLUMN onboarded_at TYPE BIGINT;\nALTER TABLE career_profiles ALTER COLUMN updated_at TYPE BIGINT;\nALTER TABLE career_actions ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE career_actions ALTER COLUMN updated_at TYPE BIGINT;\nALTER TABLE roadmap_items ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE score_snapshots ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE opportunity_analyses ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE document_blobs ALTER COLUMN created_at TYPE BIGINT;\nALTER TABLE activity_history ALTER COLUMN created_at TYPE BIGINT;\n",
  },
];
