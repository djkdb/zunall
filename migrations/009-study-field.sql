-- 전공 계열·학과·희망 직무를 프로필에 저장한다.
-- 이 값으로 스킬 추천·목표 템플릿·활동 추천을 개인화한다.
-- Neon SQL Editor 등에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS study_field TEXT;
ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS major TEXT;
ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS role_key TEXT;
