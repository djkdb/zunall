-- 모의 면접: 질문 → 답변 → 분석 → 꼬리질문 → 종합 리포트.
-- 진행 상태 전체(질문·답변·분석·리포트)를 data(JSON)에 담는다.
-- version 은 같은 답변이 두 번 처리되지 않게 하는 낙관적 잠금이다.
-- 여러 번 실행해도 안전합니다.

CREATE TABLE IF NOT EXISTS mock_interviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT,
  position TEXT NOT NULL,
  company_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  overall_score INTEGER,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  completed_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_mock_interviews_user ON mock_interviews(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mock_interviews_activity ON mock_interviews(activity_id);
