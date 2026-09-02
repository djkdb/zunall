-- 사용자별 화면 설정(대시보드 위젯 구성).
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  dashboard_widgets TEXT,
  updated_at BIGINT NOT NULL
);
