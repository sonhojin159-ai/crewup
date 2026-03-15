-- =============================================
-- schema-fixes.sql
-- QA/보안 검토에서 발견된 DB 스키마 문제 수정
-- Supabase SQL Editor에서 실행 필요
-- =============================================

-- [A4] point_transactions CHECK 제약에 'gifticon' 타입 누락 수정
-- 기프티콘 교환 시 'gifticon' 타입으로 INSERT하나 제약에 없어 트랜잭션 롤백 발생
ALTER TABLE point_transactions
DROP CONSTRAINT IF EXISTS point_transactions_type_check;

ALTER TABLE point_transactions
ADD CONSTRAINT point_transactions_type_check
CHECK (type IN (
  'charge',
  'entry_payment',
  'escrow_release',
  'refund',
  'platform_fee',
  'reward',
  'forfeiture',
  'gifticon'
));

-- [W1] ledger-evidence 버킷 public → private 변경
-- 현재 public=true로 설정되어 파일 경로만 알면 누구든 접근 가능
-- signed URL 방식(API에서 이미 구현)과 일치시키기 위해 비공개로 변경
UPDATE storage.buckets
SET public = false
WHERE id = 'ledger-evidence';

-- [C4] settlement_transfers에 is_settled 컬럼 추가
ALTER TABLE settlement_transfers ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT FALSE;

-- [C3] crew_members에 joined_at 컬럼 추가 (분배 순서 결정용)
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now();

-- =============================================
-- [C2] process_crew_creation RPC
-- 크루 생성 예치금 차감 ~ 크루 생성 ~ 미션 생성을
-- 단일 트랜잭션 + SELECT FOR UPDATE로 Race Condition 방지
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
  p_missions            JSONB
)
RETURNS JSON AS $$
DECLARE
  v_leader_fee_deposit INTEGER;
  v_balance            INTEGER;
  v_balance_after      INTEGER;
  v_new_crew_id        UUID;
  v_mission            JSONB;
  v_order_idx          INTEGER := 1;
BEGIN
  v_leader_fee_deposit := p_max_members * p_entry_points;

  IF v_leader_fee_deposit > 0 THEN
    -- SELECT FOR UPDATE: 동시 요청 차단 (Race Condition 방지)
    SELECT balance INTO v_balance
    FROM user_points
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', '포인트 지갑을 찾을 수 없습니다.');
    END IF;

    IF v_balance < v_leader_fee_deposit THEN
      RETURN json_build_object(
        'success', false,
        'error', format('크루장 예치금(%sP)이 부족합니다. (보유: %sP)', v_leader_fee_deposit, v_balance)
      );
    END IF;

    v_balance_after := v_balance - v_leader_fee_deposit;

    UPDATE user_points
    SET balance    = v_balance_after,
        updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO point_transactions (user_id, type, amount, balance_after, note)
    VALUES (
      p_user_id,
      'platform_fee',
      -v_leader_fee_deposit,
      v_balance_after,
      format('크루 생성 수수료 예치 (%s)', p_title)
    );
  END IF;

  -- 크루 생성
  INSERT INTO crews (
    title, category, role_type, track, description,
    max_members, tags, created_by,
    entry_points, deposit, leader_fee_deposit,
    leader_margin_rate, mission_reward_rate,
    status
  )
  VALUES (
    p_title, p_category, p_role_type, p_track, p_description,
    p_max_members, p_tags, p_user_id,
    p_entry_points, p_deposit, v_leader_fee_deposit,
    p_leader_margin_rate, p_mission_reward_rate,
    'active'
  )
  RETURNING id INTO v_new_crew_id;

  -- 크루장을 멤버로 등록
  INSERT INTO crew_members (crew_id, user_id, status, role, payment_status, approved_at, paid_at)
  VALUES (v_new_crew_id, p_user_id, 'active', 'owner', 'paid', now(), now())
  ON CONFLICT (crew_id, user_id) DO UPDATE
    SET status = 'active', role = 'owner', payment_status = 'paid';

  -- 미션 생성
  IF p_track = 'mission' AND p_missions IS NOT NULL AND jsonb_array_length(p_missions) > 0 THEN
    FOR v_mission IN SELECT * FROM jsonb_array_elements(p_missions)
    LOOP
      IF (v_mission->>'title') IS NOT NULL AND trim(v_mission->>'title') != '' THEN
        INSERT INTO missions (crew_id, title, description, order_index, reward_points)
        VALUES (
          v_new_crew_id,
          trim(v_mission->>'title'),
          NULLIF(trim(COALESCE(v_mission->>'description', '')), ''),
          v_order_idx,
          COALESCE((v_mission->>'rewardPoints')::INTEGER, 0)
        );
        v_order_idx := v_order_idx + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success',            true,
    'crew_id',            v_new_crew_id,
    'leader_fee_deposit', v_leader_fee_deposit
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================
-- [C3] process_crew_leave RPC
-- 크루 탈퇴 시 에스크로 몰수 + 잔여 크루원 분배 + 멤버 상태 변경을
-- 단일 트랜잭션으로 처리
-- =============================================
CREATE OR REPLACE FUNCTION process_crew_leave(
  p_crew_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_member_id         UUID;
  v_payment_status    TEXT;
  v_forfeited_total   INTEGER := 0;
  v_hold              RECORD;
  v_balance           INTEGER;
  v_remaining_members UUID[];
  v_member_count      INTEGER;
  v_share_per_member  INTEGER;
  v_remainder         INTEGER;
  v_recipient         UUID;
  v_recipient_balance INTEGER;
  v_actual_share      INTEGER;
  i                   INTEGER;
BEGIN
  -- 멤버 정보 조회
  SELECT id, payment_status INTO v_member_id, v_payment_status
  FROM crew_members
  WHERE crew_id = p_crew_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '참여 중인 크루가 아닙니다.');
  END IF;

  IF v_payment_status = 'paid' THEN
    -- 에스크로 FOR UPDATE 후 forfeited 처리
    FOR v_hold IN
      SELECT id, amount, released_amount
      FROM escrow_holds
      WHERE crew_id        = p_crew_id
        AND member_user_id = p_user_id
        AND status IN ('holding', 'partially_released')
      FOR UPDATE
    LOOP
      UPDATE escrow_holds
      SET status = 'forfeited', updated_at = now()
      WHERE id = v_hold.id;

      v_forfeited_total := v_forfeited_total + (v_hold.amount - v_hold.released_amount);
    END LOOP;

    IF v_forfeited_total > 0 THEN
      -- 탈퇴자 escrow_balance 차감 (FOR UPDATE)
      SELECT balance INTO v_balance
      FROM user_points
      WHERE user_id = p_user_id
      FOR UPDATE;

      UPDATE user_points
      SET escrow_balance = GREATEST(0, escrow_balance - v_forfeited_total),
          updated_at     = now()
      WHERE user_id = p_user_id;

      INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
      VALUES (p_user_id, 'forfeiture', -v_forfeited_total, v_balance, p_crew_id, '크루 자발적 탈퇴 - 에스크로 몰수');

      -- 잔여 활성 크루원 균등 분배
      SELECT ARRAY_AGG(user_id ORDER BY joined_at ASC) INTO v_remaining_members
      FROM crew_members
      WHERE crew_id  = p_crew_id
        AND user_id != p_user_id
        AND status   = 'active';

      v_member_count := COALESCE(array_length(v_remaining_members, 1), 0);

      IF v_member_count > 0 THEN
        v_share_per_member := v_forfeited_total / v_member_count;
        v_remainder := v_forfeited_total - (v_share_per_member * v_member_count);

        FOR i IN 1..v_member_count LOOP
          v_recipient    := v_remaining_members[i];
          -- 첫 번째 크루원에게 나머지(소수점 처리) 귀속
          v_actual_share := v_share_per_member + CASE WHEN i = 1 THEN v_remainder ELSE 0 END;

          SELECT balance INTO v_recipient_balance
          FROM user_points
          WHERE user_id = v_recipient
          FOR UPDATE;

          UPDATE user_points
          SET balance    = balance + v_actual_share,
              updated_at = now()
          WHERE user_id = v_recipient;

          INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
          VALUES (
            v_recipient,
            'escrow_release',
            v_actual_share,
            v_recipient_balance + v_actual_share,
            p_crew_id,
            '크루원 탈퇴 에스크로 분배'
          );
        END LOOP;
      END IF;
    END IF;
  END IF;

  -- 멤버 상태 변경
  UPDATE crew_members SET status = 'left' WHERE id = v_member_id;

  RETURN json_build_object(
    'success',          true,
    'forfeited_amount', v_forfeited_total
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================
-- [C4] process_settlement_transfers RPC
-- 정산 시 실제 포인트 이동 + 기록을 원자적으로 처리
-- =============================================
CREATE OR REPLACE FUNCTION process_settlement_transfers(p_entry_id UUID)
RETURNS JSON AS $$
DECLARE
  v_crew_id            UUID;
  v_entry              RECORD;
  v_crew               RECORD;
  v_net_profit         INTEGER;
  v_total_member_share INTEGER;
  v_per_member_share   INTEGER;
  v_remainder          INTEGER;
  v_member_count       INTEGER;
  v_member_list        RECORD;
  v_idx                INTEGER := 0;
  v_leader_balance     INTEGER;
  v_recipient_balance  INTEGER;
  v_already_settled    INTEGER;
BEGIN
  SELECT crew_id, revenue, expense, is_locked
  INTO v_entry
  FROM ledger_entries
  WHERE id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '장부를 찾을 수 없습니다.');
  END IF;

  IF NOT v_entry.is_locked THEN
    RETURN json_build_object('success', false, 'error', '확정된 장부만 정산할 수 있습니다.');
  END IF;

  v_crew_id := v_entry.crew_id;

  -- 중복 실행 방지
  SELECT COUNT(*) INTO v_already_settled
  FROM settlement_transfers
  WHERE entry_id = p_entry_id;

  IF v_already_settled > 0 THEN
    RETURN json_build_object('success', false, 'error', '이미 정산 기록이 존재합니다.');
  END IF;

  SELECT created_by, mission_reward_rate
  INTO v_crew
  FROM crews
  WHERE id = v_crew_id;

  -- 크루장 잔액 FOR UPDATE
  SELECT balance INTO v_leader_balance
  FROM user_points
  WHERE user_id = v_crew.created_by
  FOR UPDATE;

  v_net_profit := v_entry.revenue - v_entry.expense;

  IF v_net_profit <= 0 THEN
    RETURN json_build_object('success', false, 'error', '순수익이 0 이하입니다.');
  END IF;

  -- 플랫폼 수수료 10% 선공제 후 크루원 몫 계산
  v_total_member_share := FLOOR(v_net_profit * v_crew.mission_reward_rate / 100.0);
  v_total_member_share := FLOOR(v_total_member_share * 0.9);

  SELECT COUNT(*) INTO v_member_count
  FROM crew_members
  WHERE crew_id = v_crew_id
    AND status  = 'active'
    AND user_id != v_crew.created_by;

  IF v_member_count = 0 THEN
    RETURN json_build_object('success', false, 'error', '정산할 크루원이 없습니다.');
  END IF;

  v_per_member_share := FLOOR(v_total_member_share::NUMERIC / v_member_count);

  IF v_per_member_share <= 0 THEN
    RETURN json_build_object('success', false, 'error', '1인당 정산 금액이 0P입니다.');
  END IF;

  IF v_leader_balance < v_total_member_share THEN
    RETURN json_build_object(
      'success', false,
      'error', format('크루장 잔액(%sP)이 정산 총액(%sP)보다 부족합니다.', v_leader_balance, v_total_member_share)
    );
  END IF;

  v_remainder := v_total_member_share - (v_per_member_share * v_member_count);

  -- 각 크루원에게 포인트 지급
  FOR v_member_list IN
    SELECT user_id
    FROM crew_members
    WHERE crew_id = v_crew_id
      AND status  = 'active'
      AND user_id != v_crew.created_by
    ORDER BY joined_at ASC
  LOOP
    v_idx := v_idx + 1;

    SELECT balance INTO v_recipient_balance
    FROM user_points
    WHERE user_id = v_member_list.user_id
    FOR UPDATE;

    INSERT INTO settlement_transfers (
      entry_id, crew_id, from_user_id, to_user_id,
      amount, is_settled, sender_confirmed, receiver_confirmed
    )
    VALUES (
      p_entry_id, v_crew_id, v_crew.created_by, v_member_list.user_id,
      v_per_member_share, TRUE, TRUE, FALSE
    );

    UPDATE user_points
    SET balance      = balance + v_per_member_share,
        total_earned = total_earned + v_per_member_share,
        updated_at   = now()
    WHERE user_id = v_member_list.user_id;

    INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
    VALUES (
      v_member_list.user_id,
      'escrow_release',
      v_per_member_share,
      v_recipient_balance + v_per_member_share,
      v_crew_id,
      format('수익 분배 정산 (장부 ID: %s)', p_entry_id)
    );
  END LOOP;

  -- 크루장 잔액 차감 (소수점 나머지는 크루장 보유)
  UPDATE user_points
  SET balance    = balance - (v_total_member_share - v_remainder),
      updated_at = now()
  WHERE user_id = v_crew.created_by;

  INSERT INTO point_transactions (user_id, type, amount, balance_after, crew_id, note)
  VALUES (
    v_crew.created_by,
    'platform_fee',
    -(v_total_member_share - v_remainder),
    v_leader_balance - (v_total_member_share - v_remainder),
    v_crew_id,
    format('수익 분배 정산 지급 (장부 ID: %s)', p_entry_id)
  );

  RETURN json_build_object(
    'success',           true,
    'net_profit',        v_net_profit,
    'total_distributed', v_total_member_share,
    'per_member_share',  v_per_member_share,
    'member_count',      v_member_count,
    'remainder',         v_remainder
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
