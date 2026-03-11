-- Add address_components JSONB column for structured address data
-- Stores Google Places API addressComponents array for runtime formatting
ALTER TABLE places ADD COLUMN IF NOT EXISTS address_components jsonb DEFAULT NULL;

COMMENT ON COLUMN places.address_components IS 'Google Places API addressComponents array (language=ko). Used to format short/full Korean addresses at runtime.';
