-- ============================================================================
-- Phase 0: Activity Logging Foundation
-- 모든 사용자 활동을 activity_logs 테이블에 자동 기록하는 DB 트리거
-- 대상: places, schedule_items, checklist_items, place_votes, trip_members
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 메인 로깅 함수 (SECURITY DEFINER: RLS 우회하여 모든 활동 기록)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id     uuid;
  v_user_id     uuid;
  v_action      text;
  v_target_type text;
  v_target_id   uuid;
  v_metadata    jsonb := '{}'::jsonb;
BEGIN
  -- 인증된 사용자 확인 (시스템 작업은 건너뜀)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  CASE TG_TABLE_NAME

    -- ==================== PLACES ====================
    WHEN 'places' THEN
      v_target_type := 'place';

      IF TG_OP = 'INSERT' THEN
        v_trip_id   := NEW.trip_id;
        v_target_id := NEW.id;
        v_action    := 'place_added';
        v_metadata  := jsonb_build_object('name', NEW.name, 'category', NEW.category);

      ELSIF TG_OP = 'DELETE' THEN
        v_trip_id   := OLD.trip_id;
        v_target_id := OLD.id;
        v_action    := 'place_removed';
        v_metadata  := jsonb_build_object('name', OLD.name, 'category', OLD.category);

      ELSE
        -- UPDATE: 의미 있는 필드 변경만 기록 (enrichment 업데이트 제외)
        IF (NEW.name, NEW.category, NEW.memo, NEW.url, NEW.address)
           IS NOT DISTINCT FROM
           (OLD.name, OLD.category, OLD.memo, OLD.url, OLD.address) THEN
          RETURN NEW;
        END IF;
        v_trip_id   := NEW.trip_id;
        v_target_id := NEW.id;
        v_action    := 'place_updated';
        v_metadata  := jsonb_build_object('name', NEW.name, 'category', NEW.category);
      END IF;

    -- ==================== SCHEDULE ITEMS ====================
    WHEN 'schedule_items' THEN
      v_target_type := 'schedule_item';

      IF TG_OP = 'INSERT' THEN
        SELECT s.trip_id INTO v_trip_id
          FROM schedules s WHERE s.id = NEW.schedule_id;
        v_target_id := NEW.id;
        v_action    := 'schedule_item_added';
        v_metadata  := jsonb_build_object('title', NEW.title);

      ELSIF TG_OP = 'DELETE' THEN
        SELECT s.trip_id INTO v_trip_id
          FROM schedules s WHERE s.id = OLD.schedule_id;
        v_target_id := OLD.id;
        v_action    := 'schedule_item_removed';
        v_metadata  := jsonb_build_object('title', OLD.title);

      ELSE
        -- UPDATE: sort_order만 변경(드래그 재정렬)은 건너뜀
        RETURN NEW;
      END IF;

    -- ==================== CHECKLIST ITEMS ====================
    WHEN 'checklist_items' THEN
      v_target_type := 'checklist_item';

      IF TG_OP = 'INSERT' THEN
        v_trip_id   := NEW.trip_id;
        v_target_id := NEW.id;
        v_action    := 'checklist_item_added';
        v_metadata  := jsonb_build_object('title', NEW.title, 'category', NEW.category);

      ELSIF TG_OP = 'UPDATE' THEN
        -- is_checked 변경만 기록 (재정렬/수정은 무시)
        IF OLD.is_checked IS NOT DISTINCT FROM NEW.is_checked THEN
          RETURN NEW;
        END IF;
        v_trip_id   := NEW.trip_id;
        v_target_id := NEW.id;
        v_action    := CASE WHEN NEW.is_checked
                         THEN 'checklist_checked'
                         ELSE 'checklist_unchecked'
                       END;
        v_metadata  := jsonb_build_object('title', NEW.title, 'category', NEW.category);

      ELSIF TG_OP = 'DELETE' THEN
        v_trip_id   := OLD.trip_id;
        v_target_id := OLD.id;
        v_action    := 'checklist_item_removed';
        v_metadata  := jsonb_build_object('title', OLD.title, 'category', OLD.category);
      END IF;

    -- ==================== PLACE VOTES ====================
    WHEN 'place_votes' THEN
      v_target_type := 'place_vote';

      IF TG_OP = 'INSERT' THEN
        SELECT p.trip_id INTO v_trip_id
          FROM places p WHERE p.id = NEW.place_id;
        v_target_id := NEW.place_id;
        v_action    := 'vote_added';
        v_metadata  := jsonb_build_object(
          'place_name', (SELECT name FROM places WHERE id = NEW.place_id)
        );
      ELSE
        RETURN COALESCE(NEW, OLD);
      END IF;

    -- ==================== TRIP MEMBERS ====================
    WHEN 'trip_members' THEN
      v_target_type := 'trip_member';

      IF TG_OP = 'INSERT' THEN
        v_trip_id   := NEW.trip_id;
        v_target_id := NEW.id;
        v_user_id   := NEW.user_id;  -- 참가한 본인을 기록
        v_action    := 'member_joined';
        v_metadata  := jsonb_build_object(
          'role', NEW.role,
          'member_name', (SELECT display_name FROM profiles WHERE id = NEW.user_id)
        );
      ELSE
        RETURN COALESCE(NEW, OLD);
      END IF;

    ELSE
      RETURN COALESCE(NEW, OLD);
  END CASE;

  -- 액션이 결정된 경우에만 로그 삽입
  IF v_action IS NOT NULL AND v_trip_id IS NOT NULL THEN
    INSERT INTO activity_logs (trip_id, user_id, action, target_type, target_id, metadata)
    VALUES (v_trip_id, v_user_id, v_action, v_target_type, v_target_id, v_metadata);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ----------------------------------------------------------------------------
-- 트리거 연결
-- ----------------------------------------------------------------------------

-- places: INSERT(추가) + UPDATE(수정) + DELETE(삭제)
CREATE TRIGGER trg_places_activity
  AFTER INSERT OR UPDATE OR DELETE ON places
  FOR EACH ROW EXECUTE FUNCTION fn_log_activity();

-- schedule_items: INSERT(추가) + DELETE(제거) — UPDATE는 함수 내에서 건너뜀
CREATE TRIGGER trg_schedule_items_activity
  AFTER INSERT OR UPDATE OR DELETE ON schedule_items
  FOR EACH ROW EXECUTE FUNCTION fn_log_activity();

-- checklist_items: INSERT(추가) + UPDATE(체크 토글) + DELETE(삭제)
CREATE TRIGGER trg_checklist_items_activity
  AFTER INSERT OR UPDATE OR DELETE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION fn_log_activity();

-- place_votes: INSERT(투표)만
CREATE TRIGGER trg_place_votes_activity
  AFTER INSERT ON place_votes
  FOR EACH ROW EXECUTE FUNCTION fn_log_activity();

-- trip_members: INSERT(참가)만
CREATE TRIGGER trg_trip_members_activity
  AFTER INSERT ON trip_members
  FOR EACH ROW EXECUTE FUNCTION fn_log_activity();
