-- Add square_meters column to marketplace_service_cases table
-- This field is useful for services measured by area (painter, cleaner, flooring, etc.)

ALTER TABLE marketplace_service_cases 
ADD COLUMN IF NOT EXISTS square_meters NUMERIC;

-- Add comment to document the column
COMMENT ON COLUMN marketplace_service_cases.square_meters IS 'Area in square meters for services that are measured by area (painting, cleaning, flooring, etc.)';
