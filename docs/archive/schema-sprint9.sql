-- docs/schema-sprint9.sql
-- Sprint 9: 리스크 방어 시스템

-- ============================================================
-- 1. 면책 동의 로그 (디지털 서명 대용)
-- ============================================================
CREATE TABLE IF NOT EXISTS consent_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'signup_terms',           -- 회원가입 이용약관
    'crew_create_disclaimer', -- 크루 생성 시 면책 고지
    'crew_join_disclaimer',   -- 크루 참여 시 면책 고지
    'ledger_confirm'          -- 장부 확정 시 면책 고지
  )),
  consent_text TEXT NOT NULL,  -- 동의한 약관/면책 원문
  crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_logs_user ON consent_logs(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_logs_crew ON consent_logs(crew_id);

ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

-- 본인만 조회 가능
DROP POLICY IF EXISTS "본인 동의 로그만 조회" ON consent_logs;
CREATE POLICY "본인 동의 로그만 조회" ON consent_logs
  FOR SELECT USING (auth.uid() = user_id);

-- 인증된 유저만 삽입 가능
DROP POLICY IF EXISTS "인증된 유저만 동의 기록" ON consent_logs;
CREATE POLICY "인증된 유저만 동의 기록" ON consent_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. 신고 시스템
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'revenue_hiding',      -- 매출 은닉
    'payment_default',     -- 정산 미이행 (입금 먹튀)
    'unauthorized_expense',-- 독단적 지출
    'fraud',               -- 사기
    'harassment',          -- 괴롭힘
    'other'                -- 기타
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  admin_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_crew ON reports(crew_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 본인이 작성한 신고만 조회 가능
DROP POLICY IF EXISTS "본인 신고만 조회" ON reports;
CREATE POLICY "본인 신고만 조회" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- 인증된 유저만 신고 가능
DROP POLICY IF EXISTS "인증된 유저만 신고" ON reports;
CREATE POLICY "인증된 유저만 신고" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ============================================================
-- 3. 블랙리스트 (크루장 제재)
-- ============================================================
CREATE TABLE IF NOT EXISTS blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  banned_until TIMESTAMPTZ,  -- NULL이면 영구 제명
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

-- 누구나 블랙리스트 여부 확인 가능 (크루 생성/참여 시 체크)
DROP POLICY IF EXISTS "블랙리스트 공개 조회" ON blacklist;
CREATE POLICY "블랙리스트 공개 조회" ON blacklist
  FOR SELECT USING (true);

-- ============================================================
-- 4. 장부 영상 증빙 지원 (기존 evidence_urls 활용)
-- ============================================================
-- 별도 테이블 불필요: evidence_urls에 영상 파일 경로도 저장
-- Storage 버킷에 영상 업로드 허용 (MIME 타입 확장)

-- ledger_entries에 영상 증빙 필수 여부 컬럼 추가
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS has_video_evidence BOOLEAN DEFAULT FALSE;
