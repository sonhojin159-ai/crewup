-- docs/schema-phase4-charge-func.sql

-- 1. 포인트 충전 함수 (토스/부트페이 결제 승인 후 호출)
CREATE OR REPLACE FUNCTION process_charge_payment(
  p_user_id UUID,
  p_amount INTEGER,
  p_receipt_id TEXT
)
RETURNS void AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- 1. 중복 결제 확인 (이미 동일한 영수증 번호 로그가 있는지)
  IF EXISTS (
    SELECT 1 FROM point_transactions 
    WHERE user_id = p_user_id 
      AND type = 'charge' 
      AND note LIKE '%' || p_receipt_id || '%'
  ) THEN
    RAISE EXCEPTION '이미 처리된 결제입니다 (중복 영수증).';
  END IF;

  -- 2. 유저 포인트 락업 & 잔액 조회
  SELECT balance INTO v_balance
  FROM user_points
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- 3. 잔액 충전 업데이트
  UPDATE user_points
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  -- 4. 트랜잭션 수입 기록
  INSERT INTO point_transactions (user_id, type, amount, balance_after, note)
  VALUES (
    p_user_id, 
    'charge', 
    p_amount, 
    v_balance, 
    '부트페이 충전 완료 (영수증: ' || p_receipt_id || ')'
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
