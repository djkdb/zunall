-- 자소서 문항 유형 (지원 동기 · 협업 · 도전 …).
-- 유형을 붙여두면 비슷한 문항에 예전에 쓴 답변을 찾아줄 수 있다.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

ALTER TABLE essay_questions ADD COLUMN IF NOT EXISTS topic TEXT;
