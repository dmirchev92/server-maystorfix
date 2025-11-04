-- Migration: Add support for multiple service categories per provider
-- This allows providers to select multiple specializations based on their tier

-- ============================================================================
-- 1. CREATE PROVIDER-CATEGORY JUNCTION TABLE
-- ============================================================================
-- Note: Categories are managed in the frontend constants, not in database

CREATE TABLE IF NOT EXISTS provider_service_categories (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL, -- Category ID from frontend constants (e.g., 'electrician', 'plumber')
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_service_categories_provider ON provider_service_categories(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_service_categories_category ON provider_service_categories(category_id);

-- ============================================================================
-- 2. MIGRATE EXISTING DATA
-- ============================================================================

-- Migrate existing single service_category to the new junction table
INSERT INTO provider_service_categories (id, provider_id, category_id, created_at)
SELECT 
    'migrated_' || sp.user_id || '_' || COALESCE(
        CASE 
            WHEN LOWER(sp.service_category) = 'електротехник' THEN 'electrician'
            WHEN LOWER(sp.service_category) = 'водопроводчик' THEN 'plumber'
            WHEN LOWER(sp.service_category) = 'климатик' THEN 'hvac'
            WHEN LOWER(sp.service_category) = 'дърводелец' THEN 'carpenter'
            WHEN LOWER(sp.service_category) = 'бояджия' OR LOWER(sp.service_category) = 'боядисване' THEN 'painter'
            WHEN LOWER(sp.service_category) = 'ключар' THEN 'locksmith'
            WHEN LOWER(sp.service_category) = 'почистване' THEN 'cleaner'
            WHEN LOWER(sp.service_category) = 'градинар' THEN 'gardener'
            WHEN LOWER(sp.service_category) = 'майстор за всичко' OR LOWER(sp.service_category) = 'handyman' THEN 'handyman'
            WHEN LOWER(sp.service_category) = 'ремонт на уреди' THEN 'appliance_repair'
            WHEN LOWER(sp.service_category) = 'строител' OR LOWER(sp.service_category) = 'зидар' THEN 'mason'
            WHEN LOWER(sp.service_category) = 'мебелист' THEN 'furniture_assembly'
            WHEN LOWER(sp.service_category) = 'electrician' THEN 'electrician'
            WHEN LOWER(sp.service_category) = 'plumber' THEN 'plumber'
            ELSE sp.service_category
        END,
        'handyman'
    ),
    sp.user_id,
    COALESCE(
        CASE 
            WHEN LOWER(sp.service_category) = 'електротехник' THEN 'electrician'
            WHEN LOWER(sp.service_category) = 'водопроводчик' THEN 'plumber'
            WHEN LOWER(sp.service_category) = 'климатик' THEN 'hvac'
            WHEN LOWER(sp.service_category) = 'дърводелец' THEN 'carpenter'
            WHEN LOWER(sp.service_category) = 'бояджия' OR LOWER(sp.service_category) = 'боядисване' THEN 'painter'
            WHEN LOWER(sp.service_category) = 'ключар' THEN 'locksmith'
            WHEN LOWER(sp.service_category) = 'почистване' THEN 'cleaner'
            WHEN LOWER(sp.service_category) = 'градинар' THEN 'gardener'
            WHEN LOWER(sp.service_category) = 'майстор за всичко' OR LOWER(sp.service_category) = 'handyman' THEN 'handyman'
            WHEN LOWER(sp.service_category) = 'ремонт на уреди' THEN 'appliance_repair'
            WHEN LOWER(sp.service_category) = 'строител' OR LOWER(sp.service_category) = 'зидар' THEN 'mason'
            WHEN LOWER(sp.service_category) = 'мебелист' THEN 'furniture_assembly'
            WHEN LOWER(sp.service_category) = 'electrician' THEN 'electrician'
            WHEN LOWER(sp.service_category) = 'plumber' THEN 'plumber'
            ELSE sp.service_category
        END,
        'handyman'
    ),
    NOW()
FROM service_provider_profiles sp
WHERE sp.service_category IS NOT NULL AND sp.service_category != ''
ON CONFLICT (provider_id, category_id) DO NOTHING;

-- Note: We keep the service_category column in service_provider_profiles for backward compatibility
