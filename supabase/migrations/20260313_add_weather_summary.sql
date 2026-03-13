-- schedules 테이블에 날씨 요약 JSONB 컬럼 추가
-- weather_summary: { weather_code, label, temp_high, temp_low, precip_pct, precip_mm, icon }
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS weather_summary JSONB,
  ADD COLUMN IF NOT EXISTS weather_fetched_at TIMESTAMPTZ;

COMMENT ON COLUMN schedules.weather_summary IS 'Open-Meteo 날씨 요약 (JSONB). 키: weather_code, label, temp_high, temp_low, precip_pct, precip_mm, icon';
COMMENT ON COLUMN schedules.weather_fetched_at IS '날씨 데이터 마지막 갱신 시각';
