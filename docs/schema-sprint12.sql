-- docs/schema-sprint12.sql
-- Sprint 12: Gifticon Exchange System (Admin Code Upload + User Exchange)
-- Supabase SQL Editor에서 실행하세요.

-- 1. 기프티콘 상품 테이블 (관리자가 정의하는 상품 목록)
CREATE TABLE IF NOT EXISTS gifticon_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- 예: "배달의민족 금액권 1만원"
  brand TEXT NOT NULL,                   -- 예: "배달의민족"
  emoji TEXT NOT NULL DEFAULT '🎁',     -- 브랜드 이모지
  denomination INTEGER NOT NULL,         -- 상품 금액 (원)
  points_required INTEGER NOT NULL,      -- 교환에 필요한 포인트
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 기프티콘 코드 테이블 (관리자가 업로드한 실제 코드들)
CREATE TABLE IF NOT EXISTS gifticon_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES gifticon_products(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                    -- 실제 코드 (예: BAEMIN-XXXX-XXXX-XXXX)
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'issued')),
  issued_to UUID REFERENCES profiles(id),
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 기프티콘 교환 내역 테이블 (유저의 교환 기록)
CREATE TABLE IF NOT EXISTS gifticon_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES gifticon_products(id),
  code_id UUID NOT NULL REFERENCES gifticon_codes(id),
  points_spent INTEGER NOT NULL,
  code_revealed TEXT NOT NULL,           -- 유저에게 실제로 보여주는 코드
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS 활성화
ALTER TABLE gifticon_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifticon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifticon_exchanges ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책
-- gifticon_products: 로그인 유저는 활성 상품만 조회 가능
CREATE POLICY "Active products visible to auth users"
  ON gifticon_products FOR SELECT
  TO authenticated
  USING (is_active = true);

-- gifticon_codes: 유저는 자신에게 발급된 코드만 조회 (관리자는 service role로 접근)
CREATE POLICY "Users see their issued codes"
  ON gifticon_codes FOR SELECT
  TO authenticated
  USING (issued_to = auth.uid());

-- gifticon_exchanges: 유저는 자신의 교환 내역만 조회
CREATE POLICY "Users see their own exchanges"
  ON gifticon_exchanges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 6. 종목별 재고 수 조회를 위한 함수
CREATE OR REPLACE FUNCTION get_gifticon_stock(p_product_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*)::INTEGER FROM gifticon_codes
  WHERE product_id = p_product_id AND status = 'available';
$$;

-- 7. 원자적 포인트 차감 + 코드 발급 RPC
CREATE OR REPLACE FUNCTION process_gifticon_exchange(
  p_user_id UUID,
  p_product_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_product RECORD;
  v_code RECORD;
  v_balance INTEGER;
  v_exchange_id UUID;
BEGIN
  -- 상품 확인
  SELECT * INTO v_product FROM gifticon_products
  WHERE id = p_product_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '상품을 찾을 수 없습니다.');
  END IF;

  -- 재고 확인 (FOR UPDATE로 동시성 방지)
  SELECT * INTO v_code FROM gifticon_codes
  WHERE product_id = p_product_id AND status = 'available'
  LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '재고가 소진되었습니다. 관리자에게 문의해주세요.');
  END IF;

  -- 잔액 확인
  SELECT balance INTO v_balance FROM user_points WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_product.points_required THEN
    RETURN jsonb_build_object('success', false, 'error', '포인트가 부족합니다.');
  END IF;

  -- 포인트 차감
  UPDATE user_points
  SET balance = balance - v_product.points_required,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 포인트 내역 기록
  INSERT INTO point_transactions (user_id, type, amount, balance_after, note)
  SELECT p_user_id, 'gifticon', -v_product.points_required,
         balance, '기프티콘 교환: ' || v_product.name
  FROM user_points WHERE user_id = p_user_id;

  -- 코드 상태 업데이트
  UPDATE gifticon_codes
  SET status = 'issued', issued_to = p_user_id, issued_at = NOW()
  WHERE id = v_code.id;

  -- 교환 내역 저장
  INSERT INTO gifticon_exchanges (user_id, product_id, code_id, points_spent, code_revealed)
  VALUES (p_user_id, p_product_id, v_code.id, v_product.points_required, v_code.code)
  RETURNING id INTO v_exchange_id;

  RETURN jsonb_build_object(
    'success', true,
    'exchange_id', v_exchange_id,
    'code', v_code.code,
    'product_name', v_product.name
  );
END;
$$;

-- 8. 기본 상품 데이터 삽입 (관리자가 추후 코드 등록 필요)
INSERT INTO gifticon_products (name, brand, emoji, denomination, points_required) VALUES
  ('배달의민족 금액권 5천원', '배달의민족', '🛵', 5000, 5000),
  ('배달의민족 금액권 1만원', '배달의민족', '🛵', 10000, 10000),
  ('올리브영 금액권 1만원', '올리브영', '🌿', 10000, 10000),
  ('올리브영 금액권 3만원', '올리브영', '🌿', 30000, 30000),
  ('요기요 금액권 5천원', '요기요', '🍔', 5000, 5000),
  ('요기요 금액권 1만원', '요기요', '🍔', 10000, 10000),
  ('스타벅스 기프트 카드 1만원', '스타벅스', '☕', 10000, 10000),
  ('스타벅스 기프트 카드 3만원', '스타벅스', '☕', 30000, 30000),
  ('구글 기프트 카드 1만원', '구글', '🎮', 10000, 10000),
  ('구글 기프트 카드 3만원', '구글', '🎮', 30000, 30000),
  ('이케아 기프트 카드 1만원', '이케아', '🛋️', 10000, 10000),
  ('이케아 기프트 카드 3만원', '이케아', '🛋️', 30000, 30000)
ON CONFLICT DO NOTHING;
