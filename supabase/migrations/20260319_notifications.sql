-- ============================================================================
-- Phase 4A: Notifications System
-- activity_logs INSERT 시 자동으로 trip 멤버들에게 알림 생성
-- ============================================================================

-- ----------------------------------------------------------------------------
-- notifications 테이블
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id         uuid REFERENCES trips(id) ON DELETE CASCADE,
  type            text NOT NULL,
  title           text NOT NULL,
  body            text,
  actor_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name      text,
  target_type     text,
  target_id       text,
  is_read         boolean NOT NULL DEFAULT false,
  read_at         timestamptz,
  activity_log_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 인덱스: 유저별 안읽은 알림 빠른 조회
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC)
  WHERE is_read = false;

-- 인덱스: 유저별 피드 조회
CREATE INDEX idx_notifications_user_feed
  ON notifications (user_id, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ----------------------------------------------------------------------------
-- activity_logs → notifications 자동 생성 함수
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_create_notifications_from_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member  RECORD;
  v_title   text;
  v_body    text;
  v_actor   text;
BEGIN
  -- 액터 이름 조회
  SELECT display_name INTO v_actor
    FROM profiles WHERE id = NEW.user_id;

  IF v_actor IS NULL THEN
    v_actor := '누군가';
  END IF;

  -- 알림 본문 (대상 이름)
  v_body := COALESCE(
    NEW.metadata->>'name',
    NEW.metadata->>'title',
    NEW.metadata->>'place_name',
    NEW.metadata->>'member_name'
  );

  -- 액션별 알림 제목
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

  -- 같은 여행의 모든 멤버에게 알림 생성 (자신 제외)
  FOR v_member IN
    SELECT user_id FROM trip_members
    WHERE trip_id = NEW.trip_id
      AND user_id != NEW.user_id
  LOOP
    INSERT INTO notifications (
      user_id, trip_id, type, title, body,
      actor_id, actor_name,
      target_type, target_id,
      activity_log_id
    ) VALUES (
      v_member.user_id,
      NEW.trip_id,
      NEW.action,
      v_title,
      v_body,
      NEW.user_id,
      v_actor,
      NEW.target_type,
      NEW.target_id,
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- 트리거 연결
CREATE TRIGGER trg_activity_to_notifications
  AFTER INSERT ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION fn_create_notifications_from_activity();
