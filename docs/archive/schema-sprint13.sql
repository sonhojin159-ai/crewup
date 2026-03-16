-- docs/schema-sprint13.sql
-- Sprint 13: Review & Rating System (Crew + Leader Reputation)

-- 1. 크루 및 크루장 리뷰 테이블
CREATE TABLE IF NOT EXISTS crew_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  crew_rating INTEGER NOT NULL CHECK (crew_rating >= 1 AND crew_rating <= 5),
  leader_rating INTEGER NOT NULL CHECK (leader_rating >= 1 AND leader_rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- 한 유저가 한 크루에 대해 하나의 리뷰만 남길 수 있도록 제한
  UNIQUE(crew_id, reviewer_id)
);

-- 2. RLS 활성화
ALTER TABLE crew_reviews ENABLE ROW LEVEL SECURITY;

-- 3. RLS 정책
-- 누구나 리뷰 조회 가능
CREATE POLICY "Reviews are viewable by everyone"
  ON crew_reviews FOR SELECT
  USING (true);

-- 크루 멤버였던 유저만 리뷰 작성 가능 (status='active'였거나 현재 'active'인 경우)
CREATE POLICY "Crew members can insert reviews"
  ON crew_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crew_members
      WHERE crew_id = crew_reviews.crew_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- 자신의 리뷰만 수정/삭제 가능
CREATE POLICY "Users can update their own reviews"
  ON crew_reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid());

CREATE POLICY "Users can delete their own reviews"
  ON crew_reviews FOR DELETE
  TO authenticated
  USING (reviewer_id = auth.uid());

-- 4. 크루장 평점 요약을 위한 뷰 (선택 사항)
CREATE OR REPLACE VIEW leader_reputation AS
SELECT 
  leader_id,
  AVG(leader_rating)::NUMERIC(3,2) as avg_rating,
  COUNT(*) as review_count
FROM crew_reviews
GROUP BY leader_id;
