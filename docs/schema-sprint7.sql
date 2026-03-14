-- docs/schema-sprint7.sql

-- 1. [SEC-21] 크루 생성 제약 조건 수정 (90% -> 100% 일치)
-- 기존 제약 조건 삭제 후 재생성
ALTER TABLE crews DROP CONSTRAINT IF EXISTS check_rates_sum;
ALTER TABLE crews ADD CONSTRAINT check_rates_sum CHECK (
  track = 'revenue_share' OR (leader_margin_rate + mission_reward_rate = 100)
);

-- 2. [SEC-03] 에스크로 배분 함수 음수 방지 및 안전성 강화
CREATE OR REPLACE FUNCTION distribute_mission_reward(p_verification_id UUID)
RETURNS void AS $$
DECLARE
  v_mission_record RECORD;
  v_crew_record RECORD;
  v_member RECORD;
  v_platform_fee_rate NUMERIC := 10;
  v_total_entry INTEGER;
  v_platform_fee INTEGER;
  v_leader_margin INTEGER;
  v_member_reward INTEGER;
  v_leader_balance INTEGER;
  v_member_balance INTEGER;
  v_current_escrow INTEGER;
BEGIN
  -- 1) verification 정보 조회
  SELECT mv.crew_id, mv.mission_id, mv.verified_by, m.reward_points, m.title
  INTO v_mission_record
  FROM mission_verifications mv
  JOIN missions m ON m.id = mv.mission_id
  WHERE mv.id = p_verification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '인증 정보를 찾을 수 없습니다.';
  END IF;

  -- 2) 크루 정보 조회
  SELECT entry_points, leader_margin_rate, mission_reward_rate, created_by
  INTO v_crew_record
  FROM crews
  WHERE id = v_mission_record.crew_id;

  -- 3) 크루장 잔액 락
  SELECT balance INTO v_leader_balance
  FROM user_points
  WHERE user_id = v_crew_record.created_by
  FOR UPDATE;

  -- 4) 크루원별 배분 처리
  FOR v_member IN 
    SELECT user_id, id as member_id
    FROM crew_members 
    WHERE crew_id = v_mission_record.crew_id AND status = 'active'
  LOOP
    -- 에스크로 현황 조회 및 락 [SEC-03 강화]
    SELECT (amount - released_amount) INTO v_current_escrow
    FROM escrow_holds 
    WHERE crew_id = v_mission_record.crew_id AND member_user_id = v_member.user_id AND status IN ('holding', 'partially_released')
    FOR UPDATE;

    IF v_current_escrow IS NULL THEN
        CONTINUE; -- 이미 처리되었거나 데이터 부재 시 건너뜀
    END IF;

    -- 배분 금액 계산
    v_total_entry := v_crew_record.entry_points;
    v_member_reward := v_mission_record.reward_points;
    v_platform_fee  := FLOOR(v_total_entry * (v_platform_fee_rate / 100.0));
    v_leader_margin := FLOOR(v_total_entry * (v_crew_record.leader_margin_rate / 100.0));
    
    -- [SEC-03] 잔액 부족 검증
    IF v_current_escrow < (v_platform_fee + v_leader_margin + v_member_reward) THEN
        RAISE EXCEPTION '에스크로 잔액이 부족합니다. (필요: %, 잔액: %)', (v_platform_fee + v_leader_margin + v_member_reward), v_current_escrow;
    END IF;

    -- [크루원 업데이트]
    UPDATE user_points
    SET escrow_balance = escrow_balance - (v_platform_fee + v_leader_margin + v_member_reward),
        total_earned = total_earned + v_member_reward,
        updated_at = now()
    WHERE user_id = v_member.user_id
    RETURNING balance INTO v_member_balance;

    UPDATE escrow_holds
    SET released_amount = released_amount + (v_platform_fee + v_leader_margin + v_member_reward),
        status = CASE WHEN amount <= released_amount + (v_platform_fee + v_leader_margin + v_member_reward) THEN 'fully_released' ELSE 'partially_released' END,
        updated_at = now()
    WHERE crew_id = v_mission_record.crew_id AND member_user_id = v_member.user_id;

    -- [입금 기록]
    INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, mission_id, note)
    VALUES (v_member.user_id, 'reward', v_member_reward, v_member_balance, v_mission_record.crew_id, v_mission_record.mission_id, '미션 달성 리워드: ' || v_mission_record.title);

    -- [크루장 마진 업데이트]
    v_leader_balance := v_leader_balance + v_leader_margin;
    UPDATE user_points SET balance = v_leader_balance, updated_at = now() WHERE user_id = v_crew_record.created_by;

    INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, mission_id, note)
    VALUES (v_crew_record.created_by, 'escrow_release', v_leader_margin, v_leader_balance, v_mission_record.crew_id, v_mission_record.mission_id, '크루 운영 수익 (미션: ' || v_mission_record.title || ')');

  END LOOP;

  -- 상태 변경 
  UPDATE mission_verifications
  SET distribution_status = 'completed'
  WHERE id = p_verification_id;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. [SEC-04] 장부 증빙 Storage 보안 강화
-- 버킷을 Public에서 Private으로 수동 변경해야 함 (콘솔)
-- RLS 정책을 통해 동일 크루 멤버만 조회 가능하도록 제한
DO $$
BEGIN
    -- 기존 정책 있으면 삭제
    DROP POLICY IF EXISTS "장부 증빙은 크루 멤버만 조회 가능" ON storage.objects;
    
    -- 조회 정책 추가 (크루 멤버 여부 확인)
    CREATE POLICY "장부 증빙은 크루 멤버만 조회 가능" ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'ledger-evidence' 
      AND (
        auth.uid() IN (
          SELECT user_id FROM public.crew_members 
          WHERE crew_id = (regexp_split_to_array(name, '/'))[1]::uuid
        )
        OR
        auth.uid() IN (
          SELECT created_by FROM public.crews 
          WHERE id = (regexp_split_to_array(name, '/'))[1]::uuid
        )
      )
    );
END $$;
