-- docs/schema-sprint11.sql
-- Sprint 11: Crew Deposits & Individual Rewards

-- 1. crews 테이블에 컬럼 추가
ALTER TABLE crews ADD COLUMN IF NOT EXISTS deposit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS leader_fee_deposit INTEGER NOT NULL DEFAULT 0;

-- 2. mission_verifications 테이블 고도화 (개별 보상 지원)
-- submission_id와 user_id를 추가하여 특정 제출에 대한 인증임을 명시
ALTER TABLE mission_verifications ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES mission_submissions(id) ON DELETE CASCADE;
ALTER TABLE mission_verifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. mission_submissions 상태 추가 (이미 존재하지만 명시적 체크를 위해)
-- status: 'pending', 'approved', 'rejected'
