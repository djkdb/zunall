-- 자기소개서 문항별 코칭 테이블.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

CREATE TABLE IF NOT EXISTS essay_questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  question TEXT NOT NULL,
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
