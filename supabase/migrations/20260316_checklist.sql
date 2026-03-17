-- =============================================================
-- Checklist Feature: checklist_items + checklist_logs
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. checklist_items
-- ─────────────────────────────────────────────────────────────

CREATE TABLE checklist_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category    text        NOT NULL
    CHECK (category IN ('documents','clothing','electronics','hygiene','shared','todo','shopping')),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  is_checked  boolean     NOT NULL DEFAULT false,
  priority    text        NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high','medium','low')),
  position    integer     NOT NULL DEFAULT 0,
  assigned_to uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  memo        text        CHECK (memo IS NULL OR char_length(memo) <= 500),
  created_by  uuid        NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_items_trip_category
  ON checklist_items (trip_id, category, position);

CREATE INDEX idx_checklist_items_assigned
  ON checklist_items (trip_id, assigned_to)
  WHERE assigned_to IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. checklist_logs
-- ─────────────────────────────────────────────────────────────

CREATE TABLE checklist_logs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid        NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  action            text        NOT NULL CHECK (action IN ('checked','unchecked')),
  performed_by      uuid        NOT NULL REFERENCES profiles(id),
  performed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_logs_item
  ON checklist_logs (checklist_item_id, performed_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. updated_at 트리거
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER checklist_items_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. Realtime 활성화
-- ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE checklist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE checklist_logs;

-- ─────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_logs ENABLE ROW LEVEL SECURITY;

-- checklist_items: SELECT (멤버만)
CREATE POLICY "checklist_items_select_member"
  ON checklist_items FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

-- checklist_items: INSERT (editor/admin)
CREATE POLICY "checklist_items_insert_editor_admin"
  ON checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    is_trip_editor_or_admin(trip_id)
    AND auth.uid() = created_by
  );

-- checklist_items: UPDATE (editor/admin — 모든 필드)
CREATE POLICY "checklist_items_update_editor_admin"
  ON checklist_items FOR UPDATE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id))
  WITH CHECK (is_trip_editor_or_admin(trip_id));

-- checklist_items: UPDATE (viewer — is_checked 토글, 앱 레이어에서 필드 제한)
CREATE POLICY "checklist_items_update_member_check"
  ON checklist_items FOR UPDATE
  TO authenticated
  USING (
    is_trip_member(trip_id)
    AND NOT is_trip_editor_or_admin(trip_id)
  )
  WITH CHECK (is_trip_member(trip_id));

-- checklist_items: DELETE (editor/admin)
CREATE POLICY "checklist_items_delete_editor_admin"
  ON checklist_items FOR DELETE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id));

-- checklist_logs: SELECT (멤버만)
CREATE POLICY "checklist_logs_select_member"
  ON checklist_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM checklist_items ci
      WHERE ci.id = checklist_logs.checklist_item_id
        AND is_trip_member(ci.trip_id)
    )
  );

-- checklist_logs: INSERT (모든 멤버 — viewer 포함)
CREATE POLICY "checklist_logs_insert_member"
  ON checklist_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = performed_by
    AND EXISTS (
      SELECT 1 FROM checklist_items ci
      WHERE ci.id = checklist_logs.checklist_item_id
        AND is_trip_member(ci.trip_id)
    )
  );
