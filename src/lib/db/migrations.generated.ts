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
    sql: "-- 시간 컬럼(밀리초)을 BIGINT 로 맞춘다.\n-- 예전 버전 schema.sql 로 만든 DB 는 이 컬럼들이 INTEGER 라서\n-- \"value ... is out of range for type integer\" 오류가 난다.\n--\n-- 문장 하나가 곧 DB 요청 하나이므로(서버리스 드라이버), 개별 ALTER 를 나열하지 않고\n-- DO 블록 하나로 처리한다. 여러 번 실행해도 안전하다.\n\nDO $$\nDECLARE\n  target RECORD;\nBEGIN\n  FOR target IN\n    SELECT * FROM (VALUES\n      ('users','created_at'),\n      ('push_subscriptions','created_at'),\n      ('push_subscriptions','last_success_at'),\n      ('sessions','expires_at'),\n      ('activities','created_at'),\n      ('activities','updated_at'),\n      ('events','created_at'),\n      ('tasks','created_at'),\n      ('tasks','updated_at'),\n      ('tasks','completed_at'),\n      ('documents','created_at'),\n      ('submissions','created_at'),\n      ('submissions','updated_at'),\n      ('submission_versions','created_at'),\n      ('retrospectives','created_at'),\n      ('retrospectives','updated_at'),\n      ('essay_questions','created_at'),\n      ('essay_drafts','created_at'),\n      ('ai_reviews','created_at'),\n      ('ai_reviews','completed_at'),\n      ('notifications','created_at'),\n      ('notes','updated_at'),\n      ('career_goals','created_at'),\n      ('career_goals','updated_at'),\n      ('user_skills','created_at'),\n      ('career_evidence','created_at'),\n      ('career_profiles','onboarded_at'),\n      ('career_profiles','updated_at'),\n      ('career_actions','created_at'),\n      ('career_actions','updated_at'),\n      ('roadmap_items','created_at'),\n      ('score_snapshots','created_at'),\n      ('opportunity_analyses','created_at'),\n      ('document_blobs','created_at'),\n      ('activity_history','created_at')\n    ) AS t(table_name, column_name)\n  LOOP\n    IF EXISTS (\n      SELECT 1 FROM information_schema.columns\n      WHERE table_schema = 'public'\n        AND table_name = target.table_name\n        AND column_name = target.column_name\n        AND data_type IN ('integer', 'smallint')\n    ) THEN\n      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE BIGINT', target.table_name, target.column_name);\n    END IF;\n  END LOOP;\nEND\n$$;\n",
  },
  {
    name: "007-fix-all-epoch-columns.sql",
    sql: "-- 시간(밀리초) 컬럼을 이름으로 찾아 전부 BIGINT 로 바꾼다.\n--\n-- 006 은 코드가 아는 컬럼만 고쳤다. 예전 버전 스키마로 만든 DB 에는 목록에 없는\n-- 컬럼이 남아 있을 수 있어(그 경우 \"out of range for type integer\" 가 계속 난다),\n-- 여기서는 information_schema 를 뒤져 _at 으로 끝나는 정수 컬럼을 모두 교정한다.\n-- 여러 번 실행해도 안전하다.\n\nDO $$\nDECLARE\n  target RECORD;\nBEGIN\n  FOR target IN\n    SELECT c.table_name, c.column_name\n    FROM information_schema.columns c\n    JOIN information_schema.tables t\n      ON t.table_schema = c.table_schema AND t.table_name = c.table_name\n    WHERE c.table_schema = 'public'\n      AND t.table_type = 'BASE TABLE'\n      AND c.data_type IN ('integer', 'smallint')\n      AND (c.column_name LIKE '%\\_at' OR c.column_name IN ('expires', 'timestamp'))\n  LOOP\n    EXECUTE format(\n      'ALTER TABLE public.%I ALTER COLUMN %I TYPE BIGINT',\n      target.table_name,\n      target.column_name\n    );\n    RAISE NOTICE 'BIGINT 로 변경: %.%', target.table_name, target.column_name;\n  END LOOP;\nEND\n$$;\n",
  },
  {
    name: "008-user-settings.sql",
    sql: "-- 사용자별 화면 설정(대시보드 위젯 구성).\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nCREATE TABLE IF NOT EXISTS user_settings (\n  user_id TEXT PRIMARY KEY,\n  dashboard_widgets TEXT,\n  updated_at BIGINT NOT NULL\n);\n",
  },
  {
    name: "009-study-field.sql",
    sql: "-- 전공 계열·학과·희망 직무를 프로필에 저장한다.\n-- 이 값으로 스킬 추천·목표 템플릿·활동 추천을 개인화한다.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS study_field TEXT;\nALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS major TEXT;\nALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS role_key TEXT;\n",
  },
  {
    name: "010-account.sql",
    sql: "-- 계정 관리: 약관 동의 시각, 비밀번호 재설정 토큰.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nALTER TABLE users ADD COLUMN IF NOT EXISTS terms_agreed_at BIGINT;\n\nCREATE TABLE IF NOT EXISTS password_resets (\n  token TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  expires_at BIGINT NOT NULL,\n  used_at BIGINT,\n  created_at BIGINT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);\n",
  },
  {
    name: "011-notice-sources.sql",
    sql: "-- 공고 자동 수집: 관심 사이트(소스)와 거기서 찾아낸 공고 목록.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nCREATE TABLE IF NOT EXISTS notice_sources (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  name TEXT NOT NULL,\n  url TEXT NOT NULL,\n  keywords TEXT,\n  active INTEGER NOT NULL DEFAULT 1,\n  last_checked_at BIGINT,\n  last_error TEXT,\n  last_found INTEGER NOT NULL DEFAULT 0,\n  created_at BIGINT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_notice_sources_user ON notice_sources(user_id);\n\nCREATE TABLE IF NOT EXISTS notice_items (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  source_id TEXT NOT NULL,\n  url TEXT NOT NULL,\n  title TEXT NOT NULL,\n  published_at TEXT,\n  status TEXT NOT NULL DEFAULT 'new',\n  activity_id TEXT,\n  found_at BIGINT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_notice_items_user ON notice_items(user_id);\nCREATE UNIQUE INDEX IF NOT EXISTS idx_notice_items_url ON notice_items(source_id, url);\n",
  },
  {
    name: "012-notify-settings.sql",
    sql: "-- 알림 세부 설정과 주간 리포트.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_thresholds TEXT;\nALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_types TEXT;\nALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiet_start INTEGER;\nALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiet_end INTEGER;\nALTER TABLE user_settings ADD COLUMN IF NOT EXISTS weekly_report INTEGER NOT NULL DEFAULT 1;\nALTER TABLE user_settings ADD COLUMN IF NOT EXISTS weekly_day INTEGER NOT NULL DEFAULT 0;\nALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone_offset INTEGER NOT NULL DEFAULT 540;\n",
  },
  {
    name: "013-essay-topic.sql",
    sql: "-- 자소서 문항 유형 (지원 동기 · 협업 · 도전 …).\n-- 유형을 붙여두면 비슷한 문항에 예전에 쓴 답변을 찾아줄 수 있다.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nALTER TABLE essay_questions ADD COLUMN IF NOT EXISTS topic TEXT;\n",
  },
  {
    name: "014-interview.sql",
    sql: "-- 면접 준비: 예상 질문과 내가 준비한 답변.\n-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.\n\nCREATE TABLE IF NOT EXISTS interview_questions (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  activity_id TEXT NOT NULL,\n  question TEXT NOT NULL,\n  why TEXT,\n  hint TEXT,\n  answer TEXT,\n  ready INTEGER NOT NULL DEFAULT 0,\n  source TEXT NOT NULL DEFAULT 'ai',\n  position INTEGER NOT NULL DEFAULT 0,\n  created_at BIGINT NOT NULL,\n  updated_at BIGINT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_interview_activity ON interview_questions(activity_id);\nCREATE INDEX IF NOT EXISTS idx_interview_user ON interview_questions(user_id);\n",
  },
];
