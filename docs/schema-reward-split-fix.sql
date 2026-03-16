-- =============================================
-- schema-reward-split-fix.sql
-- 미션 금액 산정 로직 수정 (참여금 + 예치금 합산 배분)
-- =============================================

CREATE OR REPLACE FUNCTION process_crew_creation(
  p_user_id             UUID,
  p_title               TEXT,
  p_category            TEXT,
  p_role_type           TEXT,
  p_track               TEXT,
  p_description         TEXT,
  p_max_members         INTEGER,
  p_tags                TEXT[],
  p_entry_points        INTEGER,
  p_deposit             INTEGER,
  p_leader_margin_rate  NUMERIC,
  p_mission_reward_rate NUMERIC,
  p_missions            JSONB,
  p_activity_days       INTEGER DEFAULT 7
)
RETURNS JSON AS $$
DECLARE
  v_leader_fee_deposit INTEGER;
  v_balance            INTEGER;
  v_balance_after      INTEGER;
  v_new_crew_id        UUID;
  v_mission            JSONB;
  v_order_idx          INTEGER := 1;
  v_mission_count      INTEGER;
  v_points_per_mission INTEGER := 0;
  v_total_mission_pool INTEGER;
BEGIN
  -- 1) 크루장 보증금 계산 (최대 인원 * 플랫폼 참여금)
  v_leader_fee_deposit := p_max_members * p_entry_points;

  IF v_leader_fee_deposit > 0 THEN
    SELECT balance INTO v_balance FROM user_points WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', '포인트 지갑을 찾을 수 없습니다.'); END IF;
    IF v_balance < v_leader_fee_deposit THEN
      RETURN json_build_object('success', false, 'error', format('크루장 예치금(%sP)이 부족합니다.', v_leader_fee_deposit));
    END IF;

    UPDATE user_points SET balance = balance - v_leader_fee_deposit, updated_at = now() WHERE user_id = p_user_id;
    INSERT INTO point_transactions (user_id, type, amount, balance_after, note)
    VALUES (p_user_id, 'platform_fee', -v_leader_fee_deposit, v_balance - v_leader_fee_deposit, format('크루 생성 예치금 (%s)', p_title));
  END IF;

  -- 2) 크루 생성
  INSERT INTO crews (
    title, category, role_type, track, description,
    max_members, tags, created_by,
    entry_points, deposit, leader_fee_deposit,
    leader_margin_rate, mission_reward_rate,
    status, activity_period_days, end_date
  )
  VALUES (
    p_title, p_category, p_role_type, p_track, p_description,
    p_max_members, p_tags, p_user_id,
    p_entry_points, p_deposit, v_leader_fee_deposit,
    p_leader_margin_rate, p_mission_reward_rate,
    'active', p_activity_days, now() + (p_activity_days || ' days')::INTERVAL
  )
  RETURNING id INTO v_new_crew_id;

  -- 3) 크루장을 멤버로 등록
  INSERT INTO crew_members (crew_id, user_id, status, role, payment_status, approved_at, paid_at)
  VALUES (v_new_crew_id, p_user_id, 'active', 'owner', 'paid', now(), now())
  ON CONFLICT (crew_id, user_id) DO UPDATE 
  SET status = 'active', role = 'owner', payment_status = 'paid', approved_at = now(), paid_at = now();

  -- 4) 미션 생성 및 금액 자동 배분 (중요: 참여금 + 예치금 합산)
  IF p_track = 'mission' AND p_missions IS NOT NULL AND jsonb_typeof(p_missions) = 'array' THEN
    v_mission_count := jsonb_array_length(p_missions);
    IF v_mission_count > 0 THEN
      -- 각 미션당 기본 가액 = (플랫폼 참여금 + 크루원 예치금) / 미션 수
      v_total_mission_pool := p_entry_points + p_deposit;
      v_points_per_mission := v_total_mission_pool / v_mission_count;

      FOR v_mission IN SELECT * FROM jsonb_array_elements(p_missions)
      LOOP
        INSERT INTO missions (crew_id, title, description, order_index, reward_points)
        VALUES (
          v_new_crew_id,
          trim(v_mission->>'title'),
          NULLIF(trim(COALESCE(v_mission->>'description', '')), ''),
          v_order_idx,
          v_points_per_mission
        );
        v_order_idx := v_order_idx + 1;
      END LOOP;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'crew_id', v_new_crew_id);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
