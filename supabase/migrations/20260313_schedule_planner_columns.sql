-- Phase 1: schedule_items 테이블에 순서 기반 플래너 + 이동 정보 컬럼 추가
-- arrival_by: 희망 도착 시간 (nullable TIMESTAMPTZ)
-- travel_duration_seconds: 이전 장소에서 이동 시간 (초)
-- travel_distance_meters: 이전 장소에서 이동 거리 (미터)
-- travel_mode: 이동 수단 (walking/transit/driving)
-- notify_before_minutes: 출발 알림 (분 전)

ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS arrival_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS travel_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS travel_distance_meters INTEGER,
  ADD COLUMN IF NOT EXISTS travel_mode TEXT,
  ADD COLUMN IF NOT EXISTS notify_before_minutes INTEGER DEFAULT 5;
