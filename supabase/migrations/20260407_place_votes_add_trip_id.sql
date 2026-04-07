-- Migration: place_votes에 trip_id 컬럼 추가
-- Purpose: Supabase Realtime filter를 위한 denormalization
--   filter: `trip_id=eq.${tripId}` 로 해당 여행 투표만 수신 가능하게 함
-- Security: RLS 정책을 subquery JOIN에서 직접 trip_id 비교로 단순화

-- 1. trip_id 컬럼 추가 (nullable, 백필 후 NOT NULL로 전환)
ALTER TABLE place_votes
  ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES trips(id) ON DELETE CASCADE;

-- 2. 기존 데이터 백필 (places 테이블에서 trip_id 가져오기)
UPDATE place_votes pv
SET trip_id = p.trip_id
FROM places p
WHERE pv.place_id = p.id
  AND pv.trip_id IS NULL;

-- 3. NOT NULL 제약 적용
ALTER TABLE place_votes
  ALTER COLUMN trip_id SET NOT NULL;

-- 4. 인덱스 추가 (Realtime 필터 + RLS 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_place_votes_trip_id ON place_votes(trip_id);

-- 5. RLS 정책 교체 (subquery JOIN → 직접 trip_id 비교)
-- 기존 정책 삭제
DROP POLICY IF EXISTS "place_votes_select" ON place_votes;
DROP POLICY IF EXISTS "place_votes_insert" ON place_votes;
DROP POLICY IF EXISTS "place_votes_update" ON place_votes;
DROP POLICY IF EXISTS "place_votes_delete" ON place_votes;

-- 새 정책 (trip_id 직접 비교)
CREATE POLICY "place_votes_select" ON place_votes
  FOR SELECT USING (is_trip_member(trip_id));

CREATE POLICY "place_votes_insert" ON place_votes
  FOR INSERT WITH CHECK (
    is_trip_editor_or_admin(trip_id)
    AND user_id = auth.uid()
  );

CREATE POLICY "place_votes_update" ON place_votes
  FOR UPDATE USING (user_id = auth.uid() AND is_trip_editor_or_admin(trip_id))
  WITH CHECK (user_id = auth.uid() AND is_trip_editor_or_admin(trip_id));

CREATE POLICY "place_votes_delete" ON place_votes
  FOR DELETE USING (user_id = auth.uid() AND is_trip_editor_or_admin(trip_id));
