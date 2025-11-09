-- Migration: Change budget column from numeric to text to support budget ranges
-- Budget is now stored as range strings like "250-500", "1000-1250", "2000+", etc.

-- Change budget column type in marketplace_service_cases
ALTER TABLE marketplace_service_cases 
ALTER COLUMN budget TYPE TEXT;

-- Add comment
COMMENT ON COLUMN marketplace_service_cases.budget IS 'Budget range string (e.g., "250-500", "500-750", "2000+")';
