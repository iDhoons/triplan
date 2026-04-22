-- Add area group support to schedule_items
-- Allows hierarchical organization of schedule items (groups containing places)

-- Add parent_id column for hierarchical structure
ALTER TABLE schedule_items
ADD COLUMN parent_id UUID REFERENCES schedule_items(id) ON DELETE CASCADE DEFAULT NULL;

-- Add item_type column to distinguish between groups and places
ALTER TABLE schedule_items
ADD COLUMN item_type TEXT NOT NULL DEFAULT 'place'
CHECK (item_type IN ('group', 'place'));

-- Create partial index on parent_id for better query performance
CREATE INDEX idx_schedule_items_parent ON schedule_items(parent_id) WHERE parent_id IS NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN schedule_items.parent_id IS 'Parent schedule item ID for hierarchical grouping (NULL for top-level items)';
COMMENT ON COLUMN schedule_items.item_type IS 'Type of schedule item: "group" for area groups, "place" for individual places';
