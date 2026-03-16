-- docs/schema-ledger.sql

-- 1. crews 테이블에 track 분기 추가
-- (기본값은 MVP 진행했던 'mission'으로 처리하여 기존 데이터 호환 유지)
ALTER TABLE crews ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT 'mission' 
  CHECK (track IN ('mission', 'revenue_share'));

-- 2. 장부 기입 (Ledger Entries) 테이블 생성
-- Track B (수익분배형) 크루에서 일일 거래 내역을 기록하는 코어 테이블
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  revenue INTEGER NOT NULL DEFAULT 0,
  expense INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(crew_id, date) -- 하루에 하나의 요약/총합본 장부만 허용 (간소화)
);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- 누구나 (크루원/비크루원) 해당 크루의 장부는 열람 가능 (투명성을 위함)
CREATE POLICY "ledger_entries_select" ON ledger_entries
  FOR SELECT USING (true);

-- 크루장만 장부 INSERT 가능
CREATE POLICY "ledger_entries_insert" ON ledger_entries
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT created_by FROM crews WHERE id = ledger_entries.crew_id)
  );

-- 장부가 확정(is_locked=true)되지 않았을 때만 크루장이 UPDATE/DELETE 가능
CREATE POLICY "ledger_entries_update" ON ledger_entries
  FOR UPDATE USING (
    NOT is_locked AND auth.uid() IN (SELECT created_by FROM crews WHERE id = ledger_entries.crew_id)
  );

CREATE POLICY "ledger_entries_delete" ON ledger_entries
  FOR DELETE USING (
    NOT is_locked AND auth.uid() IN (SELECT created_by FROM crews WHERE id = ledger_entries.crew_id)
  );


-- 3. 장부 승인 (Ledger Approvals) 테이블 생성
-- 크루원들이 해당 일자 장부가 맞다고 동의(Approve)하는 내역 관리
CREATE TABLE IF NOT EXISTS ledger_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES ledger_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entry_id, user_id)
);

ALTER TABLE ledger_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_approvals_select" ON ledger_approvals
  FOR SELECT USING (true);

CREATE POLICY "ledger_approvals_insert" ON ledger_approvals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ledger_approvals_update" ON ledger_approvals
  FOR UPDATE USING (auth.uid() = user_id);


-- 4. 장부 수정 이력 (Ledger Edit History) 관리 테이블
-- 잠긴 후 강제 수정이 필요한 경우(운영진 개입 등)의 오딧 로깅용
CREATE TABLE IF NOT EXISTS ledger_edit_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES ledger_entries(id),
  edited_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  old_revenue INTEGER,
  old_expense INTEGER,
  new_revenue INTEGER,
  new_expense INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ledger_edit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_edit_history_select" ON ledger_edit_history
  FOR SELECT USING (true);

-- 5. Storage 연동: 영수증 증빙용 버킷 생성
-- (수동 실행 혹은 Supabase 대시보드에서 생성 권장하지만 쿼리로 남겨둠)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ledger-evidence', 'ledger-evidence', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'ledger-evidence');

CREATE POLICY "Auth Insert" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'ledger-evidence' AND auth.role() = 'authenticated');
