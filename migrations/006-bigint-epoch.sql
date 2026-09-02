-- 시간 컬럼(밀리초)을 BIGINT 로 맞춘다.
-- 예전 버전 schema.sql 로 만든 DB 는 이 컬럼들이 INTEGER 라서
-- "value ... is out of range for type integer" 오류가 난다.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

ALTER TABLE users ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE push_subscriptions ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE push_subscriptions ALTER COLUMN last_success_at TYPE BIGINT;
ALTER TABLE sessions ALTER COLUMN expires_at TYPE BIGINT;
ALTER TABLE activities ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE activities ALTER COLUMN updated_at TYPE BIGINT;
ALTER TABLE events ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE tasks ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE tasks ALTER COLUMN updated_at TYPE BIGINT;
ALTER TABLE tasks ALTER COLUMN completed_at TYPE BIGINT;
ALTER TABLE documents ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE submissions ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE submissions ALTER COLUMN updated_at TYPE BIGINT;
ALTER TABLE submission_versions ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE retrospectives ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE retrospectives ALTER COLUMN updated_at TYPE BIGINT;
ALTER TABLE essay_questions ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE essay_drafts ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE ai_reviews ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE ai_reviews ALTER COLUMN completed_at TYPE BIGINT;
ALTER TABLE notifications ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE notes ALTER COLUMN updated_at TYPE BIGINT;
ALTER TABLE career_goals ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE career_goals ALTER COLUMN updated_at TYPE BIGINT;
ALTER TABLE user_skills ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE career_evidence ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE career_profiles ALTER COLUMN onboarded_at TYPE BIGINT;
ALTER TABLE career_profiles ALTER COLUMN updated_at TYPE BIGINT;
ALTER TABLE career_actions ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE career_actions ALTER COLUMN updated_at TYPE BIGINT;
ALTER TABLE roadmap_items ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE score_snapshots ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE opportunity_analyses ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE document_blobs ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE activity_history ALTER COLUMN created_at TYPE BIGINT;
