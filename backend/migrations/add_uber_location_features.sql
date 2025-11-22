-- Migration: Add Uber-like Location Features
-- Description: Adds location columns to cases table and creates tracking history table.
-- Date: 2025-11-19

BEGIN;

-- 1. Add Location Columns to marketplace_service_cases
ALTER TABLE marketplace_service_cases 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS formatted_address TEXT,
ADD COLUMN IF NOT EXISTS location_search_status VARCHAR(20) DEFAULT 'pending', -- pending, active, expanded, completed
ADD COLUMN IF NOT EXISTS search_radius_km INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS location_search_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exclusive_until TIMESTAMP WITH TIME ZONE;

-- 2. Add Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_cases_location_status ON marketplace_service_cases(location_search_status);
CREATE INDEX IF NOT EXISTS idx_cases_exclusive_until ON marketplace_service_cases(exclusive_until);

-- 3. Create Tracking History Table for "Live Provider Tracking"
CREATE TABLE IF NOT EXISTS sp_tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL, -- Linking to users table (assuming users.id is UUID)
    case_id UUID NOT NULL, -- Linking to marketplace_service_cases
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION, -- Direction in degrees (0-360)
    speed DOUBLE PRECISION, -- Speed in m/s
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Index for Tracking History
CREATE INDEX IF NOT EXISTS idx_tracking_case_id ON sp_tracking_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_tracking_provider_time ON sp_tracking_sessions(provider_id, timestamp DESC);

COMMIT;
