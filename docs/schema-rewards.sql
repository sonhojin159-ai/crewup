-- ============================================================
-- Reward Store (위탁 판매 리워드 시스템)
-- ============================================================

-- 리워드 상품 테이블
CREATE TABLE rewards_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  point_price INTEGER NOT NULL CHECK (point_price > 0),
  original_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 리워드 주문 테이블
CREATE TABLE reward_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  item_id UUID NOT NULL REFERENCES rewards_store(id),
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'preparing', 'shipped', 'delivered', 'cancelled')),
  tracking_number TEXT,
  admin_memo TEXT,
  consented_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  address_deleted_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX idx_reward_orders_user_id ON reward_orders(user_id);
CREATE INDEX idx_reward_orders_status ON reward_orders(status);

-- ============================================================
-- RLS 정책
-- ============================================================
ALTER TABLE rewards_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_orders ENABLE ROW LEVEL SECURITY;

-- rewards_store: 인증 유저 조회 가능
CREATE POLICY "rewards_store_read" ON rewards_store
  FOR SELECT TO authenticated USING (true);

-- reward_orders: 본인 주문만 조회
CREATE POLICY "reward_orders_own_select" ON reward_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- reward_orders: 본인만 삽입
CREATE POLICY "reward_orders_own_insert" ON reward_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- RPC: 주문 생성 + 포인트 차감 (atomic)
-- ============================================================
CREATE OR REPLACE FUNCTION process_reward_order(
  p_user_id UUID,
  p_item_id UUID,
  p_recipient_name TEXT,
  p_recipient_phone TEXT,
  p_recipient_address TEXT,
  p_consented_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item rewards_store%ROWTYPE;
  v_balance INTEGER;
  v_order_id UUID;
BEGIN
  -- 1) 상품 확인
  SELECT * INTO v_item FROM rewards_store WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '상품을 찾을 수 없습니다.');
  END IF;
  IF NOT v_item.is_available THEN
    RETURN jsonb_build_object('success', false, 'error', '현재 판매 중지된 상품입니다.');
  END IF;

  -- 2) 포인트 잔액 확인 (SELECT FOR UPDATE)
  SELECT balance INTO v_balance
    FROM user_points
    WHERE user_id = p_user_id
    FOR UPDATE;

  IF NOT FOUND OR v_balance < v_item.point_price THEN
    RETURN jsonb_build_object('success', false, 'error', '포인트가 부족합니다.');
  END IF;

  -- 3) 포인트 차감
  UPDATE user_points
    SET balance = balance - v_item.point_price,
        updated_at = now()
    WHERE user_id = p_user_id;

  -- 4) 포인트 거래 기록
  INSERT INTO point_transactions (user_id, amount, type, note)
  VALUES (p_user_id, -v_item.point_price, 'reward_order', '리워드 상품 주문: ' || v_item.title);

  -- 5) 주문 생성
  INSERT INTO reward_orders (user_id, item_id, recipient_name, recipient_phone, recipient_address, points_spent, consented_at)
  VALUES (p_user_id, p_item_id, p_recipient_name, p_recipient_phone, p_recipient_address, v_item.point_price, p_consented_at)
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'points_spent', v_item.point_price
  );
END;
$$;

-- ============================================================
-- rewards-images Storage 버킷
-- ============================================================

-- rewards-images 버킷 생성 (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('rewards-images', 'rewards-images', true)
ON CONFLICT (id) DO NOTHING;

-- 관리자만 업로드/삭제 가능 (RLS는 코드에서 service role로 처리)
-- 모든 사용자 읽기 허용
CREATE POLICY "rewards_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'rewards-images');
