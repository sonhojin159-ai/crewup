-- =============================================
-- schema-final-v2.sql
-- 크루 상태 제약 수정, 100P 올림 리워드 로직, 활동 종료 정산 RPC
-- =============================================

-- 1. crews 테이블 제약 조건 업데이트 (이미 존재하면 DROP 후 다시 생성)
ALTER TABLE crews DROP CONSTRAINT IF EXISTS crews_status_check;
ALTER TABLE crews ADD CONSTRAINT crews_status_check 
  CHECK (status IN ('active', 'abandoned', 'completed', 'disbanded'));

-- 2. point_transactions 타입 제약 확인 및 업데이트
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_type_check;
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_type_check
  CHECK (type IN (
    'charge', 'entry_payment', 'escrow_release', 'refund', 
    'platform_fee', 'reward', 'forfeiture', 'gifticon'
  ));

-- 3. crew_members 상태 제약 업데이트
ALTER TABLE crew_members DROP CONSTRAINT IF EXISTS crew_members_status_check;
ALTER TABLE crew_members ADD CONSTRAINT crew_members_status_check
  CHECK (status IN ('pending', 'active', 'left', 'kicked', 'rejected', 'disbanded', 'abandoned', 'completed'));

-- 4. [R1] 100P 올림 미션 리워드 배분 함수 (수정)
CREATE OR REPLACE FUNCTION distribute_individual_mission_reward(p_verification_id UUID)
RETURNS void AS $$
DECLARE
  v_mission_record RECORD;
  v_crew_record    RECORD;
  v_entry_points   INTEGER;
  v_mission_value  INTEGER;
  v_member_share   INTEGER;
  v_leader_share   INTEGER;
  v_leader_balance INTEGER;
  v_member_balance INTEGER;
BEGIN
  -- 1) 인증 및 미션 정보 조회
  SELECT mv.crew_id, mv.mission_id, mv.user_id, mv.submission_id, m.reward_points, m.title
  INTO v_mission_record
  FROM mission_verifications mv
  JOIN missions m ON m.id = mv.mission_id
  WHERE mv.id = p_verification_id;

  IF NOT FOUND THEN RAISE EXCEPTION '인증 정보를 찾을 수 없습니다.'; END IF;

  -- 2) 크루 정보 및 배분율 조회
  SELECT created_by, mission_reward_rate, entry_points
  INTO v_crew_record
  FROM crews
  WHERE id = v_mission_record.crew_id;

  v_mission_value := v_mission_record.reward_points;

  -- 3) 100P 올림 규칙 적용 계산
  -- Member share: ceil(Value * Rate / 100 / 100) * 100
  v_member_share := CEIL((v_mission_value * (v_crew_record.mission_reward_rate / 100.0)) / 100.0) * 100;
  v_leader_share := v_mission_value - v_member_share;

  -- 4) 크루원 포인트 지급 (에스크로 차감)
  -- 에스크로는 가입 시 v_entry_points만큼 들어있음. 
  -- 미션 달성 시마다 해당 미션의 '전체 가액(v_mission_value)'만큼 에스크로에서 빠져나감.
  -- (참여금은 모든 미션에 균등 배분되어 있으므로)
  
  -- 크루원 잔액 및 에스크로 업데이트
  UPDATE user_points
  SET balance = balance + v_member_share,
      escrow_balance = GREATEST(0, escrow_balance - v_mission_value),
      total_earned = total_earned + v_member_share,
      updated_at = now()
  WHERE user_id = v_mission_record.user_id
  RETURNING balance INTO v_member_balance;

  -- 에스크로 홀드 기록 업데이트
  UPDATE escrow_holds
  SET released_amount = released_amount + v_mission_value,
      status = CASE WHEN amount <= (released_amount + v_mission_value) THEN 'fully_released' ELSE 'partially_released' END,
      updated_at = now()
  WHERE crew_id = v_mission_record.crew_id AND member_user_id = v_mission_record.user_id;

  -- 크루원 트랜잭션 기록
  INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, mission_id, note)
  VALUES (v_mission_record.user_id, 'reward', v_member_share, v_member_balance, v_mission_record.crew_id, v_mission_record.mission_id, format('미션 달성 리워드 (%s)', v_mission_record.title));

  -- 5) 크루장 마진 지급
  IF v_leader_share > 0 THEN
    UPDATE user_points
    SET balance = balance + v_leader_share,
        updated_at = now()
    WHERE user_id = v_crew_record.created_by
    RETURNING balance INTO v_leader_balance;

    INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, mission_id, note)
    VALUES (v_crew_record.created_by, 'escrow_release', v_leader_share, v_leader_balance, v_mission_record.crew_id, v_mission_record.mission_id, format('크루 마진 (%s)', v_mission_record.title));
  END IF;

  -- 6) 상태 업데이트
  UPDATE mission_verifications SET distribution_status = 'completed' WHERE id = p_verification_id;
  UPDATE mission_submissions SET status = 'approved' WHERE id = v_mission_record.submission_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE mission_verifications SET distribution_status = 'failed', note = SQLERRM WHERE id = p_verification_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. [R2] 기간 종료 시 잔여 리워드 정산 함수
CREATE OR REPLACE FUNCTION settle_crew_residual_rewards(p_crew_id UUID)
RETURNS JSON AS $$
DECLARE
  v_crew              RECORD;
  v_member            RECORD;
  v_residual_total    INTEGER := 0;
  v_member_count      INTEGER;
  v_person_share      INTEGER;
  v_remainder         INTEGER;
  v_balance           INTEGER;
  v_hold              RECORD;
BEGIN
  -- 1) 크루 정보 조회
  SELECT * INTO v_crew FROM crews WHERE id = p_crew_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', '크루를 찾을 수 없습니다.'); END IF;
  
  -- 2) 잔여 에스크로 합산
  FOR v_hold IN
    SELECT member_user_id, (amount - released_amount) as remaining
    FROM escrow_holds
    WHERE crew_id = p_crew_id AND status IN ('holding', 'partially_released')
    FOR UPDATE
  LOOP
    v_residual_total := v_residual_total + v_hold.remaining;
    
    -- 해당 멤버 에스크로 잔액 차감
    UPDATE user_points SET escrow_balance = GREATEST(0, escrow_balance - v_hold.remaining) WHERE user_id = v_hold.member_user_id;
    UPDATE escrow_holds SET status = 'fully_released', released_amount = amount, updated_at = now() WHERE crew_id = p_crew_id AND member_user_id = v_hold.member_user_id;
  END LOOP;

  -- 3) 균등 분배 (100P 단위 내림)
  SELECT COUNT(*) INTO v_member_count FROM crew_members WHERE crew_id = p_crew_id AND status = 'active';
  
  IF v_member_count > 0 AND v_residual_total > 0 THEN
    -- 인당 분배액 = 100P 단위로 내림
    v_person_share := FLOOR((v_residual_total::NUMERIC / v_member_count) / 100.0) * 100;
    v_remainder := v_residual_total - (v_person_share * v_member_count);

    -- 각 멤버에게 지급
    FOR v_member IN SELECT user_id FROM crew_members WHERE crew_id = p_crew_id AND status = 'active'
    LOOP
      UPDATE user_points SET balance = balance + v_person_share WHERE user_id = v_member.user_id RETURNING balance INTO v_balance;
      INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
      VALUES (v_member.user_id, 'reward', v_person_share, v_balance, p_crew_id, '크루 기간 종료 잔여금 균등 배분');
    END LOOP;

    -- 나머지 잔돈(v_remainder)은 크루장에게 귀속
    UPDATE user_points SET balance = balance + v_remainder WHERE user_id = v_crew.created_by RETURNING balance INTO v_balance;
    INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
    VALUES (v_crew.created_by, 'reward', v_remainder, v_balance, p_crew_id, '크루 기간 종료 잔여금 정산 잔여분');
  END IF;

  -- 4) 크루장 보증금(leader_fee_deposit) 반환 (해산하지 않았을 때만 - 여기서는 기간 종료 정산이므로 반환)
  IF v_crew.leader_fee_deposit > 0 THEN
    UPDATE user_points SET balance = balance + v_crew.leader_fee_deposit WHERE user_id = v_crew.created_by RETURNING balance INTO v_balance;
    INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
    VALUES (v_crew.created_by, 'refund', v_crew.leader_fee_deposit, v_balance, p_crew_id, '크루 활동 정상 종료 - 보증금 환급');
  END IF;

  -- 5) 크루 상태 종료
  UPDATE crews SET status = 'completed' WHERE id = p_crew_id;

  RETURN json_build_object('success', true, 'distributed_per_person', v_person_share, 'total_residual', v_residual_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
