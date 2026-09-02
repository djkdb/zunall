-- 시간 컬럼(밀리초)을 BIGINT 로 맞춘다.
-- 예전 버전 schema.sql 로 만든 DB 는 이 컬럼들이 INTEGER 라서
-- "value ... is out of range for type integer" 오류가 난다.
--
-- 문장 하나가 곧 DB 요청 하나이므로(서버리스 드라이버), 개별 ALTER 를 나열하지 않고
-- DO 블록 하나로 처리한다. 여러 번 실행해도 안전하다.

DO $$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('users','created_at'),
      ('push_subscriptions','created_at'),
      ('push_subscriptions','last_success_at'),
      ('sessions','expires_at'),
      ('activities','created_at'),
      ('activities','updated_at'),
      ('events','created_at'),
      ('tasks','created_at'),
      ('tasks','updated_at'),
      ('tasks','completed_at'),
      ('documents','created_at'),
      ('submissions','created_at'),
      ('submissions','updated_at'),
      ('submission_versions','created_at'),
      ('retrospectives','created_at'),
      ('retrospectives','updated_at'),
      ('essay_questions','created_at'),
      ('essay_drafts','created_at'),
      ('ai_reviews','created_at'),
      ('ai_reviews','completed_at'),
      ('notifications','created_at'),
      ('notes','updated_at'),
      ('career_goals','created_at'),
      ('career_goals','updated_at'),
      ('user_skills','created_at'),
      ('career_evidence','created_at'),
      ('career_profiles','onboarded_at'),
      ('career_profiles','updated_at'),
      ('career_actions','created_at'),
      ('career_actions','updated_at'),
      ('roadmap_items','created_at'),
      ('score_snapshots','created_at'),
      ('opportunity_analyses','created_at'),
      ('document_blobs','created_at'),
      ('activity_history','created_at')
    ) AS t(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target.table_name
        AND column_name = target.column_name
        AND data_type IN ('integer', 'smallint')
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE BIGINT', target.table_name, target.column_name);
    END IF;
  END LOOP;
END
$$;
