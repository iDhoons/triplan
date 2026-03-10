-- Add enrichment fields to places table
-- For Google Places API integration and Share Target support

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS source_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_place_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enriched boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrich_error text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrich_attempts smallint DEFAULT 0;

-- Partial index for pending enrichment (only unenriched rows)
CREATE INDEX IF NOT EXISTS idx_places_pending_enrichment
  ON places (trip_id)
  WHERE enriched = false;

-- Index for duplicate Place detection
CREATE INDEX IF NOT EXISTS idx_places_google_place_id
  ON places (google_place_id)
  WHERE google_place_id IS NOT NULL;

-- Index for duplicate source_url detection
CREATE INDEX IF NOT EXISTS idx_places_source_url
  ON places (trip_id, source_url)
  WHERE source_url IS NOT NULL;

-- Existing rows are already enriched (they have data)
-- New rows from Share Target start as enriched=false
-- Default is true so manual entries don't need to set it
