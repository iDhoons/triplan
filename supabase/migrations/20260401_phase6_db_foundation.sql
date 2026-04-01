-- ============================================================================
-- Phase 6: Database Foundation (6-Expert Evaluation 기반)
-- 6-1. 핵심 인덱스 6개
-- 6-3. Schedule reorder RPC (N+1 → atomic)
-- 6-4. activity_logs 불변화 (UPDATE/DELETE 정책 제거)
-- 6-5. place_votes UPDATE RLS 추가
-- 6-6. notifications.activity_log_id text → uuid
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 6-1. 핵심 인덱스 6개
--   trip_members(trip_id, user_id)는 모든 RLS helper function이 호출하므로 최고 임팩트
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_trip_members_trip_user
  ON trip_members (trip_id, user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_trip_created
  ON activity_logs (trip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_places_trip_id
  ON places (trip_id);

CREATE INDEX IF NOT EXISTS idx_schedules_trip_id
  ON schedules (trip_id);

CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule_id
  ON schedule_items (schedule_id);

CREATE INDEX IF NOT EXISTS idx_place_votes_place_id
  ON place_votes (place_id);

-- ─────────────────────────────────────────────────────────────
-- 6-3. reorder_schedule_items RPC
--   checklist의 reorder_checklist_items와 동일 패턴
--   N개 개별 UPDATE → 1개 atomic RPC
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reorder_schedule_items(
  _schedule_id uuid,
  _ordered_ids  uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _trip_id uuid;
BEGIN
  -- schedule → trip_id 조회
  SELECT trip_id INTO _trip_id
    FROM schedules
    WHERE id = _schedule_id;

  IF _trip_id IS NULL THEN
    RAISE EXCEPTION 'Schedule not found';
  END IF;

  -- 권한 확인 (editor/admin만)
  IF NOT is_trip_editor_or_admin(_trip_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- 단일 UPDATE로 배치 처리
  UPDATE schedule_items
  SET sort_order  = idx.new_pos,
      updated_at  = now()
  FROM (
    SELECT unnest(_ordered_ids) AS id,
           generate_series(0, array_length(_ordered_ids, 1) - 1) AS new_pos
  ) AS idx
  WHERE schedule_items.id = idx.id
    AND schedule_items.schedule_id = _schedule_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6-4. activity_logs 불변화
--   감사 로그는 append-only여야 함. UPDATE/DELETE 정책 제거.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "activity_logs_update_editor_admin" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_delete_editor_admin" ON activity_logs;

-- ─────────────────────────────────────────────────────────────
-- 6-5. place_votes UPDATE RLS 추가
--   upsert(onConflict: "place_id,user_id") 시 UPDATE 권한 필요
--   본인 투표만 수정 가능
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "place_votes_update_own"
  ON place_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_trip_member(
    (SELECT trip_id FROM places WHERE id = place_id)
  ))
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 6-6. notifications.activity_log_id text → uuid
--   참조 무결성 확보 (FK 추가는 activity_logs 테이블에 의존)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE notifications
  ALTER COLUMN activity_log_id TYPE uuid USING activity_log_id::uuid;

-- ─────────────────────────────────────────────────────────────
-- 6-7. get_contribution_stats RPC
--   JS 집계 → SQL GROUP BY 전환 (stats API용)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_contribution_stats(_trip_id uuid)
RETURNS TABLE (
  user_id   uuid,
  places    bigint,
  votes     bigint,
  checklist bigint,
  schedule  bigint,
  total     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    al.user_id,
    COUNT(*) FILTER (WHERE al.action LIKE 'place_%')          AS places,
    COUNT(*) FILTER (WHERE al.action = 'vote_added')           AS votes,
    COUNT(*) FILTER (WHERE al.action LIKE 'checklist_%')       AS checklist,
    COUNT(*) FILTER (WHERE al.action LIKE 'schedule_item_%')   AS schedule,
    COUNT(*)                                                    AS total
  FROM activity_logs al
  WHERE al.trip_id = _trip_id
  GROUP BY al.user_id;
$$;
