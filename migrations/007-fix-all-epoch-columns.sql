-- 시간(밀리초) 컬럼을 이름으로 찾아 전부 BIGINT 로 바꾼다.
--
-- 006 은 코드가 아는 컬럼만 고쳤다. 예전 버전 스키마로 만든 DB 에는 목록에 없는
-- 컬럼이 남아 있을 수 있어(그 경우 "out of range for type integer" 가 계속 난다),
-- 여기서는 information_schema 를 뒤져 _at 으로 끝나는 정수 컬럼을 모두 교정한다.
-- 여러 번 실행해도 안전하다.

DO $$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('integer', 'smallint')
      AND (c.column_name LIKE '%\_at' OR c.column_name IN ('expires', 'timestamp'))
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I TYPE BIGINT',
      target.table_name,
      target.column_name
    );
    RAISE NOTICE 'BIGINT 로 변경: %.%', target.table_name, target.column_name;
  END LOOP;
END
$$;
