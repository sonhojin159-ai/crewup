-- docs/schema-sprint6.sql

-- 1. 크루 해산 버그 픽스: crews 테이블에 status 컬럼 누락 수정
ALTER TABLE crews ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disbanded'));

-- 2. 관리자 300,000 포인트 지급 (가장 먼저 가입한 유저 1명을 관리자로 간주)
DO $$
DECLARE
  v_admin_id UUID;
  v_balance INTEGER;
BEGIN
  -- 가장 오래된 유저 1명 선택
  SELECT id INTO v_admin_id FROM profiles ORDER BY created_at ASC LIMIT 1;
  
  IF v_admin_id IS NOT NULL THEN
    -- 포인트 추가
    UPDATE user_points
    SET balance = balance + 300000,
        updated_at = now()
    WHERE user_id = v_admin_id
    RETURNING balance INTO v_balance;

    -- 트랜잭션 기록
    INSERT INTO point_transactions (user_id, type, amount, balance_after, note)
    VALUES (v_admin_id, 'charge', 300000, v_balance, '관리자 서비스 지급 포인트');
  END IF;
END $$;

-- 3. 지원 전 사전 채팅 시스템 테이블
CREATE TABLE IF NOT EXISTS crew_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(crew_id, applicant_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES crew_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 채팅 RLS
ALTER TABLE crew_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 채팅방 조회: 신청자 본인 혹은 크루장
DROP POLICY IF EXISTS "크루장과 신청자만 채팅방 조회" ON crew_chats;
CREATE POLICY "크루장과 신청자만 채팅방 조회" ON crew_chats
  FOR SELECT USING (
    auth.uid() = applicant_id OR 
    auth.uid() IN (SELECT created_by FROM crews WHERE id = crew_id)
  );

-- 채팅방 개설: 인증된 유저
DROP POLICY IF EXISTS "인증된 유저만 채팅방 개설" ON crew_chats;
CREATE POLICY "인증된 유저만 채팅방 개설" ON crew_chats
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 메시지 조회: 해당 채팅방 참여자(신청자 or 크루장)
DROP POLICY IF EXISTS "참여자만 메시지 조회" ON chat_messages;
CREATE POLICY "참여자만 메시지 조회" ON chat_messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT applicant_id FROM crew_chats WHERE id = chat_id
      UNION
      SELECT c.created_by FROM crew_chats cc JOIN crews c ON cc.crew_id = c.id WHERE cc.id = chat_id
    )
  );

-- 메시지 작성: 해당 채팅방 참여자(신청자 or 크루장)
DROP POLICY IF EXISTS "참여자만 메시지 작성" ON chat_messages;
CREATE POLICY "참여자만 메시지 작성" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT applicant_id FROM crew_chats WHERE id = chat_id
      UNION
      SELECT c.created_by FROM crew_chats cc JOIN crews c ON cc.crew_id = c.id WHERE cc.id = chat_id
    )
  );
