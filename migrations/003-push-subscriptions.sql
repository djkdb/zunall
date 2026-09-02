-- 브라우저 푸시 알림 구독 테이블.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

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
