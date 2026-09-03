-- 알림 세부 설정과 주간 리포트.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_thresholds TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_types TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiet_start INTEGER;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiet_end INTEGER;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS weekly_report INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS weekly_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone_offset INTEGER NOT NULL DEFAULT 540;
