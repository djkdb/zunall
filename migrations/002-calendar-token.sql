-- 캘린더 구독(.ics) 주소용 토큰 컬럼.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_caltoken ON users(calendar_token);
