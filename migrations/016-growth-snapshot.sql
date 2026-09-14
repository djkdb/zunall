-- 성장 기록을 하루 한 점으로 고정한다.
-- 지금까지는 "같은 날이면 갱신"을 SELECT 후 UPDATE 로 처리해 왕복이 두 번이었고,
-- 같은 날 두 요청이 겹치면 행이 두 개 생길 수 있었다.
-- day 컬럼 + 유니크 인덱스로 한 문장 upsert 가 가능해진다.
-- 여러 번 실행해도 안전합니다.

ALTER TABLE score_snapshots ADD COLUMN IF NOT EXISTS day TEXT;

-- 기존 행에 day 를 채운다 (epoch ms → UTC 날짜)
UPDATE score_snapshots
   SET day = to_char(to_timestamp(created_at / 1000.0) AT TIME ZONE 'UTC', 'YYYY-MM-DD')
 WHERE day IS NULL;

-- 같은 사용자·같은 날 중복 행이 이미 있다면 최신 것만 남긴다
DELETE FROM score_snapshots s
 USING score_snapshots t
 WHERE s.user_id = t.user_id
   AND s.day = t.day
   AND s.created_at < t.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_user_day ON score_snapshots(user_id, day);
