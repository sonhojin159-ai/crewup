-- docs/schema-sprint8.sql
-- Sprint 8: 보안/QA 점검 후 수정사항

-- ============================================================
-- 1. [Q1] 크루 내부 그룹 채팅용 crew_messages 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS crew_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_messages_crew_id ON crew_messages(crew_id, created_at);

ALTER TABLE crew_messages ENABLE ROW LEVEL SECURITY;

-- 크루 활성 멤버만 메시지 조회 가능
DROP POLICY IF EXISTS "크루 멤버만 메시지 조회" ON crew_messages;
CREATE POLICY "크루 멤버만 메시지 조회" ON crew_messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM crew_members
      WHERE crew_id = crew_messages.crew_id AND status = 'active'
    )
  );

-- 크루 활성 멤버만 메시지 작성 가능 + user_id는 본인만
DROP POLICY IF EXISTS "크루 멤버만 메시지 작성" ON crew_messages;
CREATE POLICY "크루 멤버만 메시지 작성" ON crew_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() IN (
      SELECT user_id FROM crew_members
      WHERE crew_id = crew_messages.crew_id AND status = 'active'
    )
  );

-- Realtime: crew_messages는 이미 등록되어 있으므로 생략

-- ============================================================
-- 2. [Q3] 미션 인증 제출 (크루원 -> 크루장 검토)
-- ============================================================
CREATE TABLE IF NOT EXISTS mission_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mission_id, submitted_by)
);

CREATE INDEX IF NOT EXISTS idx_mission_submissions_crew ON mission_submissions(crew_id, created_at DESC);

ALTER TABLE mission_submissions ENABLE ROW LEVEL SECURITY;

-- 크루 멤버는 제출 내역 조회 가능
DROP POLICY IF EXISTS "크루 멤버는 인증 피드 조회 가능" ON mission_submissions;
CREATE POLICY "크루 멤버는 인증 피드 조회 가능" ON mission_submissions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM crew_members
      WHERE crew_id = mission_submissions.crew_id AND status = 'active'
    )
  );

-- 크루 활성 멤버만 인증 제출 가능
DROP POLICY IF EXISTS "크루 멤버만 인증 제출" ON mission_submissions;
CREATE POLICY "크루 멤버만 인증 제출" ON mission_submissions
  FOR INSERT WITH CHECK (
    auth.uid() = submitted_by
    AND auth.uid() IN (
      SELECT user_id FROM crew_members
      WHERE crew_id = mission_submissions.crew_id AND status = 'active'
    )
  );

-- 크루장만 인증 승인/거절 가능
DROP POLICY IF EXISTS "크루장만 인증 심사" ON mission_submissions;
CREATE POLICY "크루장만 인증 심사" ON mission_submissions
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT created_by FROM crews WHERE id = mission_submissions.crew_id
    )
  );

-- ============================================================
-- 3. [S8] 장부 전원동의 + 잠금 원자적 처리 RPC
-- ============================================================
CREATE OR REPLACE FUNCTION approve_and_lock_ledger(
  p_entry_id UUID,
  p_crew_id UUID,
  p_user_id UUID,
  p_approved BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_total_members INTEGER;
  v_approved_count INTEGER;
  v_result JSON;
BEGIN
  -- 1. 장부 행 잠금 (FOR UPDATE)
  SELECT is_locked INTO v_is_locked
  FROM ledger_entries
  WHERE id = p_entry_id AND crew_id = p_crew_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '장부를 찾을 수 없습니다.');
  END IF;

  IF v_is_locked THEN
    RETURN json_build_object('success', false, 'error', '이미 확정된 장부입니다.');
  END IF;

  -- 2. 승인 기록 Upsert
  INSERT INTO ledger_approvals (entry_id, user_id, approved)
  VALUES (p_entry_id, p_user_id, p_approved)
  ON CONFLICT (entry_id, user_id)
  DO UPDATE SET approved = p_approved, approved_at = NOW();

  -- 3. 전원 동의 체크 (approved=true인 경우만)
  IF p_approved THEN
    SELECT COUNT(*) INTO v_total_members
    FROM crew_members
    WHERE crew_id = p_crew_id AND status = 'active';

    SELECT COUNT(*) INTO v_approved_count
    FROM ledger_approvals
    WHERE entry_id = p_entry_id AND approved = true;

    IF v_approved_count >= v_total_members THEN
      UPDATE ledger_entries
      SET is_locked = true, locked_at = NOW()
      WHERE id = p_entry_id;

      RETURN json_build_object('success', true, 'approved', true, 'locked', true);
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'approved', p_approved, 'locked', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
