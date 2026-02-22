-- Migration: Add location schedule settings for Service Providers
-- This allows SPs to set automatic start/stop times for location sharing

CREATE TABLE IF NOT EXISTS provider_location_schedule (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Schedule enabled flag
    schedule_enabled BOOLEAN DEFAULT FALSE,
    
    -- Daily time window (stored as HH:MM format, 24-hour)
    start_time VARCHAR(5) DEFAULT '08:00',  -- e.g., '08:00'
    end_time VARCHAR(5) DEFAULT '21:00',    -- e.g., '21:00'
    
    -- Weekend settings
    disable_weekends BOOLEAN DEFAULT FALSE,
    
    -- Individual day overrides (NULL means use default schedule)
    monday_enabled BOOLEAN DEFAULT TRUE,
    tuesday_enabled BOOLEAN DEFAULT TRUE,
    wednesday_enabled BOOLEAN DEFAULT TRUE,
    thursday_enabled BOOLEAN DEFAULT TRUE,
    friday_enabled BOOLEAN DEFAULT TRUE,
    saturday_enabled BOOLEAN DEFAULT TRUE,
    sunday_enabled BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_provider_location_schedule_user_id ON provider_location_schedule(user_id);

-- Add comment for documentation
COMMENT ON TABLE provider_location_schedule IS 'Stores location sharing schedule settings for service providers';
