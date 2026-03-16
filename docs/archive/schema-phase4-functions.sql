-- docs/schema-phase4-functions.sql

-- 1. 참여금 결제 처리 함수 (크루장 승인 시 호출)
CREATE OR REPLACE FUNCTION process_entry_payment(p_crew_member_id UUID)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
  v_crew_id UUID;
  v_entry_points INTEGER;
  v_balance INTEGER;
  v_payment_status TEXT;
BEGIN
  -- crew_member 정보 및 소속 crew 정보 조회
  SELECT cm.user_id, cm.crew_id, cm.payment_status, c.entry_points
  INTO v_user_id, v_crew_id, v_payment_status, v_entry_points
  FROM crew_members cm
  JOIN crews c ON c.id = cm.crew_id
  WHERE cm.id = p_crew_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '크루 멤버 정보를 찾을 수 없습니다.';
  END IF;

  IF v_payment_status = 'paid' THEN
    RAISE EXCEPTION '이미 결제된 멤버입니다.';
  END IF;

  -- 무료 크루인 경우 상태만 업데이트하고 종료
  IF v_entry_points = 0 THEN
    UPDATE crew_members
    SET payment_status = 'paid', paid_at = now()
    WHERE id = p_crew_member_id;
    RETURN;
  END IF;

  -- 유저 포인트 잔액 조회 (SELECT FOR UPDATE로 동시성 제어)
  SELECT balance INTO v_balance
  FROM user_points
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_balance < v_entry_points THEN
    RAISE EXCEPTION '포인트가 부족합니다. (현재: %, 필요: %)', v_balance, v_entry_points;
  END IF;

  -- 1) user_points 업데이트 (잔액 차감, 에스크로 증가)
  UPDATE user_points
  SET balance = balance - v_entry_points,
      escrow_balance = escrow_balance + v_entry_points,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- 2) escrow_holds 인서트
  INSERT INTO escrow_holds (crew_id, member_user_id, amount, status)
  VALUES (v_crew_id, v_user_id, v_entry_points, 'holding');

  -- 3) point_transactions 인서트
  INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
  VALUES (
    v_user_id, 
    'entry_payment', 
    -v_entry_points, 
    v_balance - v_entry_points, 
    v_crew_id, 
    '크루 참여금 결제'
  );

  -- 4) crew_members 업데이트
  UPDATE crew_members
  SET payment_status = 'paid', paid_at = now()
  WHERE id = p_crew_member_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. 미션 리워드 배분 함수 (미션 인증 시 호출)
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
BEGIN
  -- verification 정보 조회
  SELECT mv.crew_id, mv.mission_id, mv.verified_by, m.reward_points, m.title
  INTO v_mission_record
  FROM mission_verifications mv
  JOIN missions m ON m.id = mv.mission_id
  WHERE mv.id = p_verification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '인증 정보를 찾을 수 없습니다.';
  END IF;

  -- 크루 배분율 정보 조회
  SELECT entry_points, leader_margin_rate, mission_reward_rate, created_by
  INTO v_crew_record
  FROM crews
  WHERE id = v_mission_record.crew_id;

  -- 크루장 잔액 락 (리더 마진 추가 목적)
  SELECT balance INTO v_leader_balance
  FROM user_points
  WHERE user_id = v_crew_record.created_by
  FOR UPDATE;

  -- 전체 active 크루원 반복 처리
  FOR v_member IN 
    SELECT user_id, id as member_id
    FROM crew_members 
    WHERE crew_id = v_mission_record.crew_id AND status = 'active'
  LOOP
    -- 에스크로 락
    PERFORM id FROM escrow_holds 
    WHERE crew_id = v_mission_record.crew_id AND member_user_id = v_member.user_id AND status IN ('holding', 'partially_released')
    FOR UPDATE;

    -- 배분 계산 기준금액은 항상 각 크루원이 낸 원금
    v_total_entry := v_crew_record.entry_points;
    
    -- 부분 계산 (FLOOR로 정수화)
    v_member_reward := v_mission_record.reward_points;
    v_platform_fee  := FLOOR(v_total_entry * (v_platform_fee_rate / 100.0));
    v_leader_margin := FLOOR(v_total_entry * (v_crew_record.leader_margin_rate / 100.0));
    
    -- NOTE: 실제 배분 비율 검증이나, 소수점 자투리 처리는 추가 계산 로직이 필요.
    -- 단순화를 위해 여기서는 정해진 reward_points만큼 지급.
    -- 플랫폼 수수료 등의 차감은 전체 종료(정산) 시 한 번에 하거나, 
    -- 각 미션마다 비율대로 쪼개서 출금 처리해야 함 (기획에 따라 다름).
    -- 현재 문서 명세에 따라, 미션 달성 시마다 member_reward 지급, 리더 마진 누적처리 진행.

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

    -- [크루원 리워드 입금 기록]
    INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, mission_id, note)
    VALUES (v_member.user_id, 'reward', v_member_reward, v_member_balance, v_mission_record.crew_id, v_mission_record.mission_id, '미션 달성 리워드: ' || v_mission_record.title);

    -- [크루장 마진 업데이트]
    v_leader_balance := v_leader_balance + v_leader_margin;
    UPDATE user_points
    SET balance = v_leader_balance,
        updated_at = now()
    WHERE user_id = v_crew_record.created_by;

    -- [크루장 마진 입금 기록]
    INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, mission_id, note)
    VALUES (v_crew_record.created_by, 'escrow_release', v_leader_margin, v_leader_balance, v_mission_record.crew_id, v_mission_record.mission_id, '크루 운영 수익 (미션: ' || v_mission_record.title || ')');

  END LOOP;

  -- 상태 변경 
  UPDATE mission_verifications
  SET distribution_status = 'completed'
  WHERE id = p_verification_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE mission_verifications
  SET distribution_status = 'failed',
      note = SQLERRM
  WHERE id = p_verification_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. 크루장 귀책 해산 전액 환급 함수
CREATE OR REPLACE FUNCTION process_full_refund(p_crew_id UUID)
RETURNS void AS $$
DECLARE
  v_hold RECORD;
  v_refund_amount INTEGER;
  v_balance INTEGER;
BEGIN
  -- 환급 대상 에스크로 조회 및 락
  FOR v_hold IN 
    SELECT id, member_user_id, amount, released_amount 
    FROM escrow_holds 
    WHERE crew_id = p_crew_id AND status IN ('holding', 'partially_released')
    FOR UPDATE
  LOOP
    v_refund_amount := v_hold.amount - v_hold.released_amount;
    
    IF v_refund_amount > 0 THEN
      -- 유저 잔액 락
      SELECT balance INTO v_balance
      FROM user_points
      WHERE user_id = v_hold.member_user_id
      FOR UPDATE;

      -- 유저 잔액 환불 및 에스크로 차감
      UPDATE user_points
      SET balance = balance + v_refund_amount,
          escrow_balance = escrow_balance - v_refund_amount,
          updated_at = now()
      WHERE user_id = v_hold.member_user_id
      RETURNING balance INTO v_balance;

      -- 에스크로 상태 갱신
      UPDATE escrow_holds
      SET status = 'refunded',
          updated_at = now()
      WHERE id = v_hold.id;

      -- 환급 기록 생성
      INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
      VALUES (v_hold.member_user_id, 'refund', v_refund_amount, v_balance, p_crew_id, '크루 해산에 따른 참여금 환불');
    END IF;
  END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
