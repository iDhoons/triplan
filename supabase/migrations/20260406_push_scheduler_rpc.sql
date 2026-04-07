-- get_due_departure_items: 출발 알림이 필요한 일정 항목 조회
-- push-scheduler Edge Function에서 매분 호출
CREATE OR REPLACE FUNCTION get_due_departure_items(
  window_start TIMESTAMPTZ,
  window_end   TIMESTAMPTZ
)
RETURNS TABLE (
  schedule_item_id UUID,
  user_id          UUID,
  title            TEXT,
  arrival_by       TIMESTAMPTZ,
  travel_duration_seconds INTEGER,
  trip_id          UUID,
  schedule_date    DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    si.id                       AS schedule_item_id,
    tm.user_id,
    si.title,
    si.arrival_by,
    si.travel_duration_seconds,
    s.trip_id,
    s.date                      AS schedule_date
  FROM schedule_items si
  JOIN schedules s ON s.id = si.schedule_id
  JOIN trip_members tm ON tm.trip_id = s.trip_id
  WHERE
    si.arrival_by IS NOT NULL
    AND si.travel_duration_seconds IS NOT NULL
    AND si.notify_before_minutes > 0
    -- 출발 시각 = arrival_by - travel_duration - notify_before
    AND (
      si.arrival_by
      - (si.travel_duration_seconds || ' seconds')::INTERVAL
      - (si.notify_before_minutes  || ' minutes')::INTERVAL
    ) BETWEEN window_start AND window_end;
$$;
