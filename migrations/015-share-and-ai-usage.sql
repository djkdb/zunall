-- 포트폴리오 공유 링크와 AI 사용량 기록.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_portfolio_token ON users(portfolio_token);

-- 하루 단위 AI 호출 횟수 (사용자 × 날짜)
CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_user_day ON ai_usage(user_id, day);
