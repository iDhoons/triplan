-- =============================================================
-- RLS Policies for travel-planner
-- All 12 tables: profiles, trips, trip_members, places,
--   place_votes, schedules, schedule_items, budgets,
--   expenses, settlements, trip_journals, activity_logs
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Helper Functions
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_trip_member(_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = _trip_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_trip_role(_trip_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM trip_members
  WHERE trip_id = _trip_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_trip_editor_or_admin(_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = _trip_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'editor')
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Enable RLS on all tables
-- ─────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 3. profiles
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No DELETE policy → deletes are denied

-- ─────────────────────────────────────────────────────────────
-- 4. trips
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "trips_select_member"
  ON trips FOR SELECT
  TO authenticated
  USING (is_trip_member(id));

CREATE POLICY "trips_insert_authenticated"
  ON trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "trips_update_admin"
  ON trips FOR UPDATE
  TO authenticated
  USING (get_trip_role(id) = 'admin')
  WITH CHECK (get_trip_role(id) = 'admin');

CREATE POLICY "trips_delete_admin"
  ON trips FOR DELETE
  TO authenticated
  USING (get_trip_role(id) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- 5. trip_members
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "trip_members_select_member"
  ON trip_members FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

-- INSERT: self-join (invite code flow) or admin adding members
CREATE POLICY "trip_members_insert"
  ON trip_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id  -- self-join via invite code
    OR get_trip_role(trip_id) = 'admin'  -- admin adding others
  );

CREATE POLICY "trip_members_update_admin"
  ON trip_members FOR UPDATE
  TO authenticated
  USING (get_trip_role(trip_id) = 'admin')
  WITH CHECK (get_trip_role(trip_id) = 'admin');

CREATE POLICY "trip_members_delete_admin"
  ON trip_members FOR DELETE
  TO authenticated
  USING (get_trip_role(trip_id) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- 6. places
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "places_select_member"
  ON places FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY "places_insert_editor_admin"
  ON places FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "places_update_editor_admin"
  ON places FOR UPDATE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id))
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "places_delete_editor_admin"
  ON places FOR DELETE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id));

-- ─────────────────────────────────────────────────────────────
-- 7. place_votes
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "place_votes_select_member"
  ON place_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM places
      WHERE places.id = place_votes.place_id
        AND is_trip_member(places.trip_id)
    )
  );

-- All trip members (including viewer) can vote
CREATE POLICY "place_votes_insert_member"
  ON place_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM places
      WHERE places.id = place_votes.place_id
        AND is_trip_member(places.trip_id)
    )
  );

-- Only own votes can be deleted
CREATE POLICY "place_votes_delete_own"
  ON place_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 8. schedules
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "schedules_select_member"
  ON schedules FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY "schedules_insert_editor_admin"
  ON schedules FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "schedules_update_editor_admin"
  ON schedules FOR UPDATE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id))
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "schedules_delete_editor_admin"
  ON schedules FOR DELETE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id));

-- ─────────────────────────────────────────────────────────────
-- 9. schedule_items (linked via schedules)
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "schedule_items_select_member"
  ON schedule_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.id = schedule_items.schedule_id
        AND is_trip_member(schedules.trip_id)
    )
  );

CREATE POLICY "schedule_items_insert_editor_admin"
  ON schedule_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.id = schedule_items.schedule_id
        AND is_trip_editor_or_admin(schedules.trip_id)
    )
  );

CREATE POLICY "schedule_items_update_editor_admin"
  ON schedule_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.id = schedule_items.schedule_id
        AND is_trip_editor_or_admin(schedules.trip_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.id = schedule_items.schedule_id
        AND is_trip_editor_or_admin(schedules.trip_id)
    )
  );

CREATE POLICY "schedule_items_delete_editor_admin"
  ON schedule_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.id = schedule_items.schedule_id
        AND is_trip_editor_or_admin(schedules.trip_id)
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 10. budgets
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "budgets_select_member"
  ON budgets FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY "budgets_insert_editor_admin"
  ON budgets FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "budgets_update_editor_admin"
  ON budgets FOR UPDATE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id))
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "budgets_delete_editor_admin"
  ON budgets FOR DELETE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id));

-- ─────────────────────────────────────────────────────────────
-- 11. expenses
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "expenses_select_member"
  ON expenses FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY "expenses_insert_editor_admin"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "expenses_update_editor_admin"
  ON expenses FOR UPDATE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id))
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "expenses_delete_editor_admin"
  ON expenses FOR DELETE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id));

-- ─────────────────────────────────────────────────────────────
-- 12. settlements
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "settlements_select_member"
  ON settlements FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY "settlements_insert_editor_admin"
  ON settlements FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "settlements_update_editor_admin"
  ON settlements FOR UPDATE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id))
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "settlements_delete_editor_admin"
  ON settlements FOR DELETE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id));

-- ─────────────────────────────────────────────────────────────
-- 13. trip_journals
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "trip_journals_select_member"
  ON trip_journals FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY "trip_journals_insert_editor_admin"
  ON trip_journals FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "trip_journals_update_editor_admin"
  ON trip_journals FOR UPDATE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id))
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "trip_journals_delete_editor_admin"
  ON trip_journals FOR DELETE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id));

-- ─────────────────────────────────────────────────────────────
-- 14. activity_logs
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "activity_logs_select_member"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY "activity_logs_insert_editor_admin"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "activity_logs_update_editor_admin"
  ON activity_logs FOR UPDATE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id))
  WITH CHECK (is_trip_editor_or_admin(trip_id));

CREATE POLICY "activity_logs_delete_editor_admin"
  ON activity_logs FOR DELETE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id));
