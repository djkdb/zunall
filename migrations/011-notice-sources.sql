-- 공고 자동 수집: 관심 사이트(소스)와 거기서 찾아낸 공고 목록.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

CREATE TABLE IF NOT EXISTS notice_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  keywords TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_checked_at BIGINT,
  last_error TEXT,
  last_found INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notice_sources_user ON notice_sources(user_id);

CREATE TABLE IF NOT EXISTS notice_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  activity_id TEXT,
  found_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notice_items_user ON notice_items(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notice_items_url ON notice_items(source_id, url);
