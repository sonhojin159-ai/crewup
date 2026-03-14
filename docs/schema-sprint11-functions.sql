-- docs/schema-sprint11-functions.sql

-- 1. 개별 미션 리워드 배분 함수
CREATE OR REPLACE FUNCTION distribute_individual_mission_reward(p_verification_id UUID)
RETURNS void AS $$
DECLARE
  v_mission_record RECORD;
  v_crew_record RECORD;
  v_submission_record RECORD;
  
  v_platform_fee_rate NUMERIC := 10;
  
  v_total_entry INTEGER;
  v_platform_fee INTEGER;
  v_leader_margin INTEGER;
  v_member_reward INTEGER;
  
  v_leader_balance INTEGER;
  v_member_balance INTEGER;
BEGIN
  -- verification 및 submission 정보 조회
  SELECT mv.crew_id, mv.mission_id, mv.user_id, mv.submission_id, m.reward_points, m.title
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

  -- 특정 멤버의 에스크로 락
  PERFORM id FROM escrow_holds 
  WHERE crew_id = v_mission_record.crew_id AND member_user_id = v_mission_record.user_id AND status IN ('holding', 'partially_released')
  FOR UPDATE;

  -- 배분 계산 기준금액은 항상 해당 크루원이 낸 원금
  v_total_entry := v_crew_record.entry_points;
  
  -- 리워드 계산
  v_member_reward := v_mission_record.reward_points;
  v_platform_fee  := FLOOR(v_total_entry * (v_platform_fee_rate / 100.0));
  v_leader_margin := FLOOR(v_total_entry * (v_crew_record.leader_margin_rate / 100.0));

  -- [크루원 업데이트]
  UPDATE user_points
  SET escrow_balance = escrow_balance - (v_platform_fee + v_leader_margin + v_member_reward),
      total_earned = total_earned + v_member_reward,
      updated_at = now()
  WHERE user_id = v_mission_record.user_id
  RETURNING balance INTO v_member_balance;

  UPDATE escrow_holds
  SET released_amount = released_amount + (v_platform_fee + v_leader_margin + v_member_reward),
      status = CASE WHEN amount <= released_amount + (v_platform_fee + v_leader_margin + v_member_reward) THEN 'fully_released' ELSE 'partially_released' END,
      updated_at = now()
  WHERE crew_id = v_mission_record.crew_id AND member_user_id = v_mission_record.user_id;

  -- [크루원 리워드 입금 기록]
  INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, mission_id, note)
  VALUES (v_mission_record.user_id, 'reward', v_member_reward, v_member_balance, v_mission_record.crew_id, v_mission_record.mission_id, '미션 달성 리워드: ' || v_mission_record.title);

  -- [크루장 마진 업데이트]
  v_leader_balance := v_leader_balance + v_leader_margin;
  UPDATE user_points
  SET balance = v_leader_balance,
      updated_at = now()
  WHERE user_id = v_crew_record.created_by;

  -- [크루장 마진 입금 기록]
  INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, mission_id, note)
  VALUES (v_crew_record.created_by, 'escrow_release', v_leader_margin, v_leader_balance, v_mission_record.crew_id, v_mission_record.mission_id, '크루 운영 수익 (미션: ' || v_mission_record.title || ')');

  -- [인증 상태 변경]
  UPDATE mission_verifications
  SET distribution_status = 'completed'
  WHERE id = p_verification_id;

  -- [제출물 상태 변경]
  UPDATE mission_submissions
  SET status = 'approved'
  WHERE id = v_mission_record.submission_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE mission_verifications
  SET distribution_status = 'failed',
      note = SQLERRM
  WHERE id = p_verification_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. 고도화된 환불 함수 (크루장 해산 시)
CREATE OR REPLACE FUNCTION process_full_refund_v2(p_crew_id UUID)
RETURNS void AS $$
DECLARE
  v_hold RECORD;
  v_refund_amount INTEGER;
  v_fee_compensation INTEGER;
  v_balance INTEGER;
  v_leader_id UUID;
  v_leader_fee_deposit INTEGER;
  v_platform_fee_rate NUMERIC := 10;
BEGIN
  -- 크루 정보 및 리더 예치금 조회
  SELECT created_by, leader_fee_deposit INTO v_leader_id, v_leader_fee_deposit
  FROM crews WHERE id = p_crew_id;

  -- 환급 대상 에스크로 조회 및 락
  FOR v_hold IN 
    SELECT id, member_user_id, amount, released_amount 
    FROM escrow_holds 
    WHERE crew_id = p_crew_id AND status IN ('holding', 'partially_released')
    FOR UPDATE
  LOOP
    -- 1) 남은 에스크로 금액 면제 (원금 환불)
    v_refund_amount := v_hold.amount - v_hold.released_amount;
    
    -- 2) (추가) 크루장이 대신 내주는 수수료 보상액 계산
    -- 가입 시 수수료를 뗐다면 이를 돌려주거나, 예치금에서 충당
    -- 여기서는 단순히 리더의 leader_fee_deposit에서 멤버들에게 보상하는 개념으로 확장 가능
    -- 하지만 현재 로직상 entry_payment 시 수수료를 즉시 떼지 않고 에스크로에 넣으므로,
    -- 원금 전액(v_refund_amount)을 돌려주면 멤버는 손해가 없음.
    -- 단, 크루장의 leader_fee_deposit은 플랫폼의 몫이거나 몰수 처리됨.

    IF v_refund_amount > 0 THEN
      -- 유저 잔액 락
      SELECT balance INTO v_balance FROM user_points WHERE user_id = v_hold.member_user_id FOR UPDATE;

      UPDATE user_points
      SET balance = balance + v_refund_amount,
          escrow_balance = escrow_balance - v_refund_amount,
          updated_at = now()
      WHERE user_id = v_hold.member_user_id
      RETURNING balance INTO v_balance;

      UPDATE escrow_holds SET status = 'refunded', updated_at = now() WHERE id = v_hold.id;      -- 환급 기록 생성
      INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
      VALUES (v_hold.member_user_id, 'refund', v_refund_amount, v_balance, p_crew_id, '크루 해산에 따른 참여금 환불');
    END IF;
  END LOOP;

  -- 리더의 leader_fee_deposit 처리 (차감은 생성 시 이미 되었으므로 여기선 상태 기록 위주)
  -- 혹은 플랫폼이 가져가는 로직 추가 가능
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. 참여금 + 예치금 결제 처리 함수 (V2)
CREATE OR REPLACE FUNCTION process_entry_payment_v2(p_crew_member_id UUID)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
  v_crew_id UUID;
  v_entry_points INTEGER;
  v_deposit INTEGER;
  v_total_required INTEGER;
  v_balance INTEGER;
  v_payment_status TEXT;
BEGIN
  -- crew_member 정보 및 소속 crew 정보 조회
  SELECT cm.user_id, cm.crew_id, cm.payment_status, c.entry_points, c.deposit
  INTO v_user_id, v_crew_id, v_payment_status, v_entry_points, v_deposit
  FROM crew_members cm
  JOIN crews c ON c.id = cm.crew_id
  WHERE cm.id = p_crew_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '크루 멤버 정보를 찾을 수 없습니다.';
  END IF;

  IF v_payment_status = 'paid' THEN
    RAISE EXCEPTION '이미 결제된 멤버입니다.';
  END IF;

  v_total_required := v_entry_points + v_deposit;

  -- 무료 크루인 경우 상태만 업데이트하고 종료
  IF v_total_required = 0 THEN
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

  IF v_balance < v_total_required THEN
    RAISE EXCEPTION '포인트가 부족합니다. (현재: %, 필요: %)', v_balance, v_total_required;
  END IF;

  -- 1) user_points 업데이트 (잔액 차감, 에스크로 증가)
  UPDATE user_points
  SET balance = balance - v_total_required,
      escrow_balance = escrow_balance + v_total_required,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- 2) escrow_holds 인서트
  INSERT INTO escrow_holds (crew_id, member_user_id, amount, status)
  VALUES (v_crew_id, v_user_id, v_total_required, 'holding');

  -- 3) point_transactions 인서트
  INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
  VALUES (
    v_user_id, 
    'entry_payment', 
    -v_total_required, 
    v_balance - v_total_required, 
    v_crew_id, 
    '크루 참여금 및 예치금 결제'
  );

  -- 4) crew_members 업데이트
  UPDATE crew_members
  SET payment_status = 'paid', paid_at = now()
  WHERE id = p_crew_member_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
