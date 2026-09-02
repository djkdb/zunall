-- 활동 회고(STAR) 테이블.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

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
