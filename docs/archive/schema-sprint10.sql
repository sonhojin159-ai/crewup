-- docs/schema-sprint10.sql
-- Sprint 10: P2P 수익 분배 정산 시스템

-- ============================================================
-- 0. consent_logs에 settlement_disclaimer 타입 추가
-- ============================================================
ALTER TABLE consent_logs DROP CONSTRAINT IF EXISTS consent_logs_consent_type_check;
ALTER TABLE consent_logs ADD CONSTRAINT consent_logs_consent_type_check
  CHECK (consent_type IN (
    'signup_terms',
    'crew_create_disclaimer',
    'crew_join_disclaimer',
    'ledger_confirm',
    'settlement_disclaimer'
  ));

-- ============================================================
-- 1. 정산 송금 추적 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS settlement_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES ledger_entries(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  sender_confirmed BOOLEAN DEFAULT FALSE,
  receiver_confirmed BOOLEAN DEFAULT FALSE,
  sender_confirmed_at TIMESTAMPTZ,
  receiver_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_entry ON settlement_transfers(entry_id);
CREATE INDEX IF NOT EXISTS idx_settlement_crew ON settlement_transfers(crew_id);

ALTER TABLE settlement_transfers ENABLE ROW LEVEL SECURITY;

-- 크루 멤버만 조회 가능
DROP POLICY IF EXISTS "크루 멤버만 정산 조회" ON settlement_transfers;
CREATE POLICY "크루 멤버만 정산 조회" ON settlement_transfers
  FOR SELECT USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );

-- 정산 기록 삽입 (크루장만)
DROP POLICY IF EXISTS "크루장만 정산 기록 생성" ON settlement_transfers;
CREATE POLICY "크루장만 정산 기록 생성" ON settlement_transfers
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- 본인 관련 정산만 업데이트 가능
DROP POLICY IF EXISTS "본인 정산만 확인" ON settlement_transfers;
CREATE POLICY "본인 정산만 확인" ON settlement_transfers
  FOR UPDATE USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );
