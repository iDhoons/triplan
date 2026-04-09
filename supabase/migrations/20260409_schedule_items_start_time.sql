-- schedule_items 테이블에 시작 시간(start_time) 컬럼 추가
-- start_time: 일정 시작 시간 (TIME 타입 - HH:MM:SS)
-- Routes API departureTime 연동에 사용됨

ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS start_time TIME;
