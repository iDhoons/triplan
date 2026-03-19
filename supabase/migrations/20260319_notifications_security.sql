-- ============================================================================
-- Notifications 보안 강화
-- H-003: 직접 INSERT 차단, H-004: 삭제 정책, M-007: 배치 INSERT 전환
-- ============================================================================

-- 직접 INSERT 차단 (SECURITY DEFINER 함수를 통해서만 생성)
CREATE POLICY "notifications_no_direct_insert"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 자기 알림 삭제 허용
CREATE POLICY "users delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- 알림 생성 함수를 INSERT ... SELECT 배치 방식으로 전환
CREATE OR REPLACE FUNCTION fn_create_notifications_from_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body  text;
  v_actor text;
BEGIN
  SELECT display_name INTO v_actor
    FROM profiles WHERE id = NEW.user_id;

  IF v_actor IS NULL THEN
    v_actor := '누군가';
  END IF;

  v_body := COALESCE(
    NEW.metadata->>'name',
    NEW.metadata->>'title',
    NEW.metadata->>'place_name',
    NEW.metadata->>'member_name'
  );

  v_title := CASE NEW.action
    WHEN 'place_added'           THEN v_actor || '님이 장소를 추가했습니다'
    WHEN 'place_removed'         THEN v_actor || '님이 장소를 삭제했습니다'
    WHEN 'place_updated'         THEN v_actor || '님이 장소를 수정했습니다'
    WHEN 'vote_added'            THEN v_actor || '님이 투표했습니다'
    WHEN 'schedule_item_added'   THEN v_actor || '님이 일정에 추가했습니다'
    WHEN 'schedule_item_removed' THEN v_actor || '님이 일정에서 제거했습니다'
    WHEN 'checklist_item_added'  THEN v_actor || '님이 체크리스트를 추가했습니다'
    WHEN 'checklist_checked'     THEN v_actor || '님이 항목을 완료했습니다'
    WHEN 'checklist_unchecked'   THEN v_actor || '님이 완료를 취소했습니다'
    WHEN 'checklist_item_removed' THEN v_actor || '님이 체크리스트를 삭제했습니다'
    WHEN 'member_joined'         THEN v_actor || '님이 여행에 참가했습니다'
    ELSE v_actor || '님이 활동했습니다'
  END;

  INSERT INTO notifications (
    user_id, trip_id, type, title, body,
    actor_id, actor_name, target_type, target_id, activity_log_id
  )
  SELECT
    tm.user_id, NEW.trip_id, NEW.action, v_title, v_body,
    NEW.user_id, v_actor, NEW.target_type, NEW.target_id, NEW.id
  FROM trip_members tm
  WHERE tm.trip_id = NEW.trip_id
    AND tm.user_id != NEW.user_id;

  RETURN NEW;
END;
$$;
