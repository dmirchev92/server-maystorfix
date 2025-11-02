-- Migration: Add SMS Limits to Subscription Tiers
-- Description: Implements monthly SMS limits for NORMAL tier (15 SMS/month with purchase option)
-- Date: 2025-11-02

-- ============================================================================
-- 1. ADD SMS LIMITS TO SUBSCRIPTION TIERS
-- ============================================================================

-- FREE tier: 0 SMS (trial users can't send SMS after trial expires)
UPDATE subscription_tiers 
SET limits = limits || '{"monthly_sms_limit": 0}'::jsonb 
WHERE id = 'free';

-- NORMAL tier: 15 SMS per month
UPDATE subscription_tiers 
SET limits = limits || '{"monthly_sms_limit": 15}'::jsonb 
WHERE id = 'normal';

-- PRO tier: 25 SMS per month (can purchase addons)
UPDATE subscription_tiers 
SET limits = limits || '{"monthly_sms_limit": 25}'::jsonb 
WHERE id = 'pro';

-- ============================================================================
-- 2. ADD SMS PACKAGE PURCHASES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sp_sms_packages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_type TEXT NOT NULL DEFAULT 'addon_15', -- addon_15 = 15 SMS for 40 BGN
    sms_count INTEGER NOT NULL DEFAULT 15,
    price NUMERIC(10, 2) NOT NULL DEFAULT 40.00,
    currency TEXT NOT NULL DEFAULT 'BGN',
    purchased_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITHOUT TIME ZONE, -- NULL = doesn't expire
    sms_used INTEGER NOT NULL DEFAULT 0,
    sms_remaining INTEGER NOT NULL DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'active', -- active, expired, depleted
    payment_method TEXT, -- Future: stripe, paypal, etc.
    payment_reference TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. ADD SMS USAGE TRACKING COLUMNS TO sms_settings
-- ============================================================================

-- Add monthly SMS tracking columns
ALTER TABLE sms_settings
ADD COLUMN IF NOT EXISTS monthly_sms_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_period_start TIMESTAMP WITHOUT TIME ZONE DEFAULT DATE_TRUNC('month', CURRENT_TIMESTAMP),
ADD COLUMN IF NOT EXISTS addon_sms_remaining INTEGER DEFAULT 0;

-- ============================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sp_sms_packages_user_id ON sp_sms_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_sms_packages_status ON sp_sms_packages(status);
CREATE INDEX IF NOT EXISTS idx_sp_sms_packages_expires_at ON sp_sms_packages(expires_at);

-- ============================================================================
-- 5. CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_sp_sms_packages_updated_at BEFORE UPDATE ON sp_sms_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. UPDATE TIER FEATURES TO INCLUDE SMS
-- ============================================================================

-- Add SMS feature to all tiers
UPDATE subscription_tiers 
SET features = features || '{"sms_notifications": true}'::jsonb 
WHERE id IN ('free', 'normal', 'pro');

-- ============================================================================
-- 7. INITIALIZE EXISTING USERS
-- ============================================================================

-- Set monthly_period_start for existing users
UPDATE sms_settings 
SET monthly_period_start = DATE_TRUNC('month', CURRENT_TIMESTAMP),
    monthly_sms_count = 0,
    addon_sms_remaining = 0
WHERE monthly_period_start IS NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
