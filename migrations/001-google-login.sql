-- 이미 배포된 DB에 구글 로그인 컬럼을 추가한다.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
