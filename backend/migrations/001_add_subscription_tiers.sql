-- Migration: Add Subscription Tiers System
-- Description: Implements 3-tier subscription system for Service Providers
-- Tiers: FREE (default), NORMAL (250 BGN/month), PRO (350 BGN/month)
-- Date: 2025-10-31

-- ============================================================================
-- 1. CREATE SUBSCRIPTION TIERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    name_bg TEXT NOT NULL,
    description TEXT,
    description_bg TEXT,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'BGN',
    features JSONB NOT NULL DEFAULT '{}',
    limits JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. CREATE SUBSCRIPTION TABLE (User Subscriptions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sp_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier_id TEXT NOT NULL REFERENCES subscription_tiers(id),
    status TEXT NOT NULL DEFAULT 'active', -- active, expired, cancelled, pending
    started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    cancelled_at TIMESTAMP WITHOUT TIME ZONE,
    auto_renew BOOLEAN NOT NULL DEFAULT false,
    payment_method TEXT, -- Future: stripe, paypal, bank_transfer, etc.
    last_payment_date TIMESTAMP WITHOUT TIME ZONE,
    next_payment_date TIMESTAMP WITHOUT TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tier_id, status)
);

-- ============================================================================
-- 3. CREATE SUBSCRIPTION HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sp_subscription_history (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES sp_subscriptions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier_id TEXT NOT NULL REFERENCES subscription_tiers(id),
    action TEXT NOT NULL, -- created, upgraded, downgraded, renewed, cancelled, expired
    previous_tier_id TEXT REFERENCES subscription_tiers(id),
    amount NUMERIC(10, 2),
    currency TEXT DEFAULT 'BGN',
    notes TEXT,
    performed_by TEXT, -- user_id or 'system'
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. CREATE PREMIUM LISTING BIDS TABLE (For PRO tier)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sp_premium_bids (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_category TEXT NOT NULL,
    city TEXT NOT NULL,
    neighborhood TEXT,
    bid_amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BGN',
    status TEXT NOT NULL DEFAULT 'active', -- active, outbid, expired, cancelled
    priority_score INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. CREATE TIER FEATURE USAGE TABLE (Track usage limits)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sp_feature_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    period_end TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, feature_key, period_start)
);

-- ============================================================================
-- 6. ADD TIER COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add subscription tier to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_tier_id TEXT REFERENCES subscription_tiers(id) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITHOUT TIME ZONE;

-- Add tier-related fields to service_provider_profiles
ALTER TABLE service_provider_profiles
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS premium_listing_priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS featured_until TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS profile_views_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS contact_clicks_count INTEGER DEFAULT 0;

-- ============================================================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_sp_subscriptions_user_id ON sp_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_subscriptions_tier_id ON sp_subscriptions(tier_id);
CREATE INDEX IF NOT EXISTS idx_sp_subscriptions_status ON sp_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_sp_subscriptions_expires_at ON sp_subscriptions(expires_at);

-- History indexes
CREATE INDEX IF NOT EXISTS idx_sp_subscription_history_user_id ON sp_subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_subscription_history_subscription_id ON sp_subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sp_subscription_history_created_at ON sp_subscription_history(created_at);

-- Premium bids indexes
CREATE INDEX IF NOT EXISTS idx_sp_premium_bids_user_id ON sp_premium_bids(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_premium_bids_category_city ON sp_premium_bids(service_category, city);
CREATE INDEX IF NOT EXISTS idx_sp_premium_bids_status ON sp_premium_bids(status);
CREATE INDEX IF NOT EXISTS idx_sp_premium_bids_priority ON sp_premium_bids(priority_score DESC);

-- Feature usage indexes
CREATE INDEX IF NOT EXISTS idx_sp_feature_usage_user_id ON sp_feature_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_feature_usage_feature_key ON sp_feature_usage(feature_key);
CREATE INDEX IF NOT EXISTS idx_sp_feature_usage_period ON sp_feature_usage(period_start, period_end);

-- User tier indexes
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier_id ON users(subscription_tier_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Provider premium indexes
CREATE INDEX IF NOT EXISTS idx_provider_profiles_premium ON service_provider_profiles(is_premium);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_priority ON service_provider_profiles(premium_listing_priority DESC);

-- ============================================================================
-- 8. INSERT DEFAULT SUBSCRIPTION TIERS
-- ============================================================================

INSERT INTO subscription_tiers (id, name, name_bg, description, description_bg, price_monthly, currency, features, limits, display_order, is_active)
VALUES 
(
    'free',
    'Free',
    'Безплатен',
    'Basic features for service providers starting out',
    'Основни функции за начинаещи доставчици на услуги',
    0.00,
    'BGN',
    '{
        "profile_listing": true,
        "basic_search_visibility": true,
        "customer_reviews": true,
        "case_notifications": true,
        "chat_messaging": true,
        "photo_gallery": true
    }'::jsonb,
    '{
        "max_service_categories": 2,
        "max_gallery_photos": 5,
        "max_certificates": 2,
        "monthly_case_responses": 10,
        "search_ranking": "standard",
        "analytics_access": false,
        "priority_support": false,
        "featured_listing": false,
        "premium_badge": false
    }'::jsonb,
    1,
    true
),
(
    'normal',
    'Normal',
    'Нормален',
    'Enhanced features for growing service providers',
    'Разширени функции за развиващи се доставчици',
    250.00,
    'BGN',
    '{
        "profile_listing": true,
        "enhanced_search_visibility": true,
        "customer_reviews": true,
        "case_notifications": true,
        "chat_messaging": true,
        "photo_gallery": true,
        "video_gallery": true,
        "basic_analytics": true,
        "priority_notifications": true,
        "verified_badge": true,
        "social_media_links": true,
        "business_hours": true
    }'::jsonb,
    '{
        "max_service_categories": 5,
        "max_gallery_photos": 20,
        "max_certificates": 10,
        "monthly_case_responses": 50,
        "search_ranking": "enhanced",
        "analytics_access": true,
        "priority_support": false,
        "featured_listing": false,
        "premium_badge": true
    }'::jsonb,
    2,
    true
),
(
    'pro',
    'Pro',
    'Професионален',
    'Premium features for established service providers',
    'Премиум функции за утвърдени доставчици',
    350.00,
    'BGN',
    '{
        "profile_listing": true,
        "premium_search_visibility": true,
        "customer_reviews": true,
        "case_notifications": true,
        "chat_messaging": true,
        "photo_gallery": true,
        "video_gallery": true,
        "advanced_analytics": true,
        "priority_notifications": true,
        "verified_badge": true,
        "premium_badge": true,
        "social_media_links": true,
        "business_hours": true,
        "featured_listing": true,
        "bidding_system": true,
        "priority_support": true,
        "custom_branding": true,
        "api_access": true,
        "lead_generation": true
    }'::jsonb,
    '{
        "max_service_categories": 999,
        "max_gallery_photos": 100,
        "max_certificates": 999,
        "monthly_case_responses": 999,
        "search_ranking": "premium",
        "analytics_access": true,
        "priority_support": true,
        "featured_listing": true,
        "premium_badge": true,
        "bidding_enabled": true,
        "max_active_bids": 10
    }'::jsonb,
    3,
    true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. UPDATE EXISTING USERS TO FREE TIER
-- ============================================================================

UPDATE users 
SET subscription_tier_id = 'free',
    subscription_status = 'active'
WHERE role = 'tradesperson' 
  AND subscription_tier_id IS NULL;

-- ============================================================================
-- 10. CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscription_tiers_updated_at BEFORE UPDATE ON subscription_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sp_subscriptions_updated_at BEFORE UPDATE ON sp_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sp_premium_bids_updated_at BEFORE UPDATE ON sp_premium_bids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sp_feature_usage_updated_at BEFORE UPDATE ON sp_feature_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
