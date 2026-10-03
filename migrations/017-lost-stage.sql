-- 탈락한 지원이 어느 단계에서 끝났는지 (document | test | interview | final).
-- "탈락" 하나로만 기록하면 서류에서 막히는지 면접에서 막히는지 구분할 수 없다.
-- 여러 번 실행해도 안전합니다.

ALTER TABLE activities ADD COLUMN IF NOT EXISTS lost_stage TEXT;
