-- docs/schema-phase4.sql

-- 1. crews 테이블에 컬럼 추가 (이미 존재해도 오류 안 나도록 IF NOT EXISTS 사용)
ALTER TABLE crews ADD COLUMN IF NOT EXISTS entry_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS leader_margin_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS mission_reward_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_rates_sum') THEN
    ALTER TABLE crews ADD CONSTRAINT check_rates_sum CHECK (leader_margin_rate + mission_reward_rate <= 90);
  END IF;
END $$;

-- 2. crew_members 테이블에 컬럼 추가
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 3. user_points 테이블
CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  escrow_balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_points_select" ON user_points;
CREATE POLICY "user_points_select" ON user_points
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_points_update" ON user_points;
CREATE POLICY "user_points_update" ON user_points
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. point_transactions 테이블
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('charge', 'entry_payment', 'escrow_release', 'refund', 'platform_fee', 'reward', 'forfeiture')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  mission_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "point_transactions_select" ON point_transactions;
CREATE POLICY "point_transactions_select" ON point_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- 5. escrow_holds 테이블
CREATE TABLE IF NOT EXISTS escrow_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  released_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'holding' CHECK (status IN ('holding', 'partially_released', 'fully_released', 'refunded', 'forfeited')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE escrow_holds ENABLE ROW LEVEL SECURITY;

-- 본인 또는 크루장만 조회 가능
DROP POLICY IF EXISTS "escrow_holds_select" ON escrow_holds;
CREATE POLICY "escrow_holds_select" ON escrow_holds
  FOR SELECT USING (
    auth.uid() = member_user_id 
    OR 
    auth.uid() IN (SELECT created_by FROM crews WHERE id = escrow_holds.crew_id)
  );

-- 6. missions 테이블
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- fk constraint update for transaction table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mission_id') THEN
    ALTER TABLE point_transactions ADD CONSTRAINT fk_mission_id FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE SET NULL;
  END IF;
END $$;


ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능
DROP POLICY IF EXISTS "missions_select" ON missions;
CREATE POLICY "missions_select" ON missions
  FOR SELECT USING (true);

-- 크루장만 INSERT 가능
DROP POLICY IF EXISTS "missions_insert" ON missions;
CREATE POLICY "missions_insert" ON missions
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT created_by FROM crews WHERE id = crew_id)
  );

-- 7. mission_verifications 테이블
CREATE TABLE IF NOT EXISTS mission_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  verified_by UUID NOT NULL REFERENCES profiles(id),
  verified_at TIMESTAMPTZ DEFAULT now(),
  distribution_status TEXT DEFAULT 'pending' CHECK (distribution_status IN ('pending', 'completed', 'failed')),
  note TEXT
);

ALTER TABLE mission_verifications ENABLE ROW LEVEL SECURITY;

-- 조회는 해당 크루원 + 크루장
DROP POLICY IF EXISTS "mission_verifications_select" ON mission_verifications;
CREATE POLICY "mission_verifications_select" ON mission_verifications
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM crew_members WHERE crew_id = mission_verifications.crew_id)
    OR
    auth.uid() IN (SELECT created_by FROM crews WHERE id = mission_verifications.crew_id)
  );

-- 크루장만 INSERT 가능
DROP POLICY IF EXISTS "mission_verifications_insert" ON mission_verifications;
CREATE POLICY "mission_verifications_insert" ON mission_verifications
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT created_by FROM crews WHERE id = crew_id)
  );

-- 8. 회원가입 시 user_points 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_points (user_id, balance, escrow_balance, total_earned)
  VALUES (NEW.id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_wallet();

-- 9. 기존 유저 backfill (수동)
INSERT INTO public.user_points (user_id, balance, escrow_balance, total_earned)
SELECT id, 0, 0, 0 FROM profiles
WHERE id NOT IN (SELECT user_id FROM user_points)
ON CONFLICT (user_id) DO NOTHING;
