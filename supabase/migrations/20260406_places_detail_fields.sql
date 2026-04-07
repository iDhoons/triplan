-- URL Enrichment: places 테이블에 상세 정보 필드 추가
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS website        TEXT,
  ADD COLUMN IF NOT EXISTS review_count   INTEGER,
  ADD COLUMN IF NOT EXISTS price_level    SMALLINT,
  ADD COLUMN IF NOT EXISTS price_range    TEXT,
  ADD COLUMN IF NOT EXISTS business_status TEXT DEFAULT 'OPERATIONAL',
  ADD COLUMN IF NOT EXISTS description    TEXT;
