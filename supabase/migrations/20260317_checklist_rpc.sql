-- =============================================================
-- Checklist Phase 2: RPC 함수 + DB 트리거
-- 1. toggle_checklist_check — viewer 안전 토글 + 원자적 로그
-- 2. reorder_checklist_items — 배치 순서 변경 (N+1 → 1)
-- 3. checklist_toggle_log 트리거 — 로그 자동 기록
-- 4. viewer UPDATE 정책 제거 (RPC로 대체)
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. toggle_checklist_check RPC
--    viewer 포함 모든 멤버가 is_checked만 토글 가능
--    로그는 트리거가 자동 기록
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_checklist_check(
  _item_id   uuid,
  _is_checked boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _trip_id uuid;
BEGIN
  -- 아이템 존재 확인 + trip_id 조회
  SELECT trip_id INTO _trip_id
    FROM checklist_items
    WHERE id = _item_id;

  IF _trip_id IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  -- 멤버십 확인 (viewer 포함)
  IF NOT is_trip_member(_trip_id) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  -- is_checked만 변경 (다른 컬럼 건드리지 않음)
  UPDATE checklist_items
    SET is_checked = _is_checked
    WHERE id = _item_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. reorder_checklist_items RPC
--    단일 트랜잭션으로 카테고리 내 순서 일괄 변경
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reorder_checklist_items(
  _trip_id     uuid,
  _category    text,
  _ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 권한 확인 (editor/admin만)
  IF NOT is_trip_editor_or_admin(_trip_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- 단일 UPDATE로 배치 처리
  UPDATE checklist_items
  SET position = idx.new_pos
  FROM (
    SELECT unnest(_ordered_ids) AS id,
           generate_series(0, array_length(_ordered_ids, 1) - 1) AS new_pos
  ) AS idx
  WHERE checklist_items.id = idx.id
    AND checklist_items.trip_id = _trip_id
    AND checklist_items.category = _category;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. checklist_toggle_log 트리거
--    is_checked 변경 시 자동 로그 기록
--    action 값은 DB에서 결정 (클라이언트 위조 방지)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_checklist_toggle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_checked IS DISTINCT FROM NEW.is_checked THEN
    INSERT INTO checklist_logs (checklist_item_id, action, performed_by)
    VALUES (
      NEW.id,
      CASE WHEN NEW.is_checked THEN 'checked' ELSE 'unchecked' END,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checklist_toggle_log
  AFTER UPDATE OF is_checked ON checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION log_checklist_toggle();

-- ─────────────────────────────────────────────────────────────
-- 4. viewer UPDATE 정책 제거 (RPC로 대체)
--    viewer는 이제 toggle_checklist_check RPC로만 is_checked 변경
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "checklist_items_update_member_check" ON checklist_items;
