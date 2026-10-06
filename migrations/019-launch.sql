-- 출시 준비: 남용 방지 카운터 + 사용자 의견함.
-- 여러 번 실행해도 안전합니다.

-- 로그인 실패·비밀번호 재설정 메일·둘러보기 계정 만들기 횟수.
-- key 마다 창(window) 하나를 두고 그 안의 횟수만 센다.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- 앱 안에서 보낸 의견. 답장 받기를 고른 경우에만 이메일을 남긴다.
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'idea',
  message TEXT NOT NULL,
  page TEXT,
  reply_email TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
