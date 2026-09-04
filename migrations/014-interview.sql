-- 면접 준비: 예상 질문과 내가 준비한 답변.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

CREATE TABLE IF NOT EXISTS interview_questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  question TEXT NOT NULL,
  why TEXT,
  hint TEXT,
  answer TEXT,
  ready INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'ai',
  position INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interview_activity ON interview_questions(activity_id);
CREATE INDEX IF NOT EXISTS idx_interview_user ON interview_questions(user_id);
