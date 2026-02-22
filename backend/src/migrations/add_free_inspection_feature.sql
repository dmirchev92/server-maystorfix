-- Migration: Add Free Inspection/Quote Feature
-- This feature allows SPs to mark themselves as available for free inspections
-- and customers to get notified when matching SPs are nearby

-- 1. Add free_inspection_active column to service_provider_profiles
ALTER TABLE service_provider_profiles 
ADD COLUMN IF NOT EXISTS free_inspection_active BOOLEAN DEFAULT false;

ALTER TABLE service_provider_profiles 
ADD COLUMN IF NOT EXISTS free_inspection_activated_at TIMESTAMP WITH TIME ZONE;

-- 2. Create customer_free_inspection_preferences table
CREATE TABLE IF NOT EXISTS customer_free_inspection_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    radius_km INTEGER DEFAULT 3 CHECK (radius_km >= 1 AND radius_km <= 5),
    categories TEXT[] DEFAULT '{}',
    show_only_free_inspection BOOLEAN DEFAULT false,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_free_inspection_user ON customer_free_inspection_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_free_inspection_enabled ON customer_free_inspection_preferences(enabled) WHERE enabled = true;

-- Create index on service_provider_profiles for free inspection queries
CREATE INDEX IF NOT EXISTS idx_sp_free_inspection_active ON service_provider_profiles(free_inspection_active) WHERE free_inspection_active = true;

-- 3. Create a table to track free inspection notifications sent (to avoid duplicates)
CREATE TABLE IF NOT EXISTS free_inspection_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_free_inspection_notif_customer ON free_inspection_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_free_inspection_notif_provider ON free_inspection_notifications(provider_id);

-- Add comment for documentation
COMMENT ON TABLE customer_free_inspection_preferences IS 'Stores customer preferences for free inspection alerts from nearby service providers';
COMMENT ON COLUMN service_provider_profiles.free_inspection_active IS 'Whether the SP is currently offering free inspections/quotes';
COMMENT ON COLUMN service_provider_profiles.free_inspection_activated_at IS 'When the SP last activated free inspection mode';
