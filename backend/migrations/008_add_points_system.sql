-- Migration: Add Points System for Case Access
-- Description: Implements points-based system for service providers to access cases based on budget tiers
-- Date: 2025-11-04
-- 
-- Points System Rules:
-- FREE tier: 40 points, can see cases up to 500 BGN
--   - 1-500 BGN cases cost 8 points (5 cases total)
-- NORMAL tier: 150 points, can see cases up to 1500 BGN
--   - 1-500 BGN: 8 points
--   - 500-1000 BGN: 15 points
--   - 1000-1500 BGN: 20 points
-- PRO tier: 250 points, can see all budgets
--   - 1-500 BGN: 5 points
--   - 500-1000 BGN: 10 points
--   - 1000-1500 BGN: 15 points
--   - 1500-2000 BGN: 20 points
--   - 2000-3000 BGN: 30 points
--   - 3000-4000 BGN: 40 points
--   - 4000-5000 BGN: 50 points

-- ============================================================================
-- 1. ADD BUDGET COLUMN TO CASES TABLE
-- ============================================================================

ALTER TABLE marketplace_service_cases
ADD COLUMN IF NOT EXISTS budget NUMERIC(10, 2) DEFAULT 0.00;

-- ============================================================================
-- 2. ADD POINTS COLUMNS TO USERS TABLE
-- ============================================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS points_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_total_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_total_spent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_last_reset TIMESTAMP WITHOUT TIME ZONE;

-- ============================================================================
-- 3. CREATE POINTS TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sp_points_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL, -- earned, spent, refund, reset, bonus
    points_amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    case_id TEXT REFERENCES marketplace_service_cases(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. CREATE CASE ACCESS TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sp_case_access (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    case_id TEXT NOT NULL REFERENCES marketplace_service_cases(id) ON DELETE CASCADE,
    points_spent INTEGER NOT NULL,
    case_budget NUMERIC(10, 2),
    accessed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, case_id)
);

-- ============================================================================
-- 5. UPDATE SUBSCRIPTION TIERS WITH POINTS CONFIGURATION
-- ============================================================================

-- FREE tier: 40 points, max budget 500 BGN
UPDATE subscription_tiers 
SET limits = limits || '{
    "points_monthly": 40,
    "max_case_budget": 500,
    "points_cost_1_500": 8,
    "points_cost_500_1000": 0,
    "points_cost_1000_1500": 0,
    "points_cost_1500_2000": 0,
    "points_cost_2000_3000": 0,
    "points_cost_3000_4000": 0,
    "points_cost_4000_5000": 0
}'::jsonb 
WHERE id = 'free';

-- NORMAL tier: 150 points, max budget 1500 BGN
UPDATE subscription_tiers 
SET limits = limits || '{
    "points_monthly": 150,
    "max_case_budget": 1500,
    "points_cost_1_500": 8,
    "points_cost_500_1000": 15,
    "points_cost_1000_1500": 20,
    "points_cost_1500_2000": 0,
    "points_cost_2000_3000": 0,
    "points_cost_3000_4000": 0,
    "points_cost_4000_5000": 0
}'::jsonb 
WHERE id = 'normal';

-- PRO tier: 250 points, unlimited budget
UPDATE subscription_tiers 
SET limits = limits || '{
    "points_monthly": 250,
    "max_case_budget": 999999,
    "points_cost_1_500": 5,
    "points_cost_500_1000": 10,
    "points_cost_1000_1500": 15,
    "points_cost_1500_2000": 20,
    "points_cost_2000_3000": 30,
    "points_cost_3000_4000": 40,
    "points_cost_4000_5000": 50
}'::jsonb 
WHERE id = 'pro';

-- ============================================================================
-- 6. INITIALIZE POINTS FOR EXISTING USERS
-- ============================================================================

-- Give existing users their tier's monthly points
UPDATE users u
SET 
    points_balance = COALESCE((
        SELECT (st.limits->>'points_monthly')::INTEGER
        FROM subscription_tiers st
        WHERE st.id = u.subscription_tier_id
    ), 40),
    points_total_earned = COALESCE((
        SELECT (st.limits->>'points_monthly')::INTEGER
        FROM subscription_tiers st
        WHERE st.id = u.subscription_tier_id
    ), 40),
    points_last_reset = CURRENT_TIMESTAMP
WHERE role = 'tradesperson' AND points_balance IS NULL;

-- ============================================================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cases_budget ON marketplace_service_cases(budget);
CREATE INDEX IF NOT EXISTS idx_users_points_balance ON users(points_balance);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON sp_points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created_at ON sp_points_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_case_access_user_id ON sp_case_access(user_id);
CREATE INDEX IF NOT EXISTS idx_case_access_case_id ON sp_case_access(case_id);
CREATE INDEX IF NOT EXISTS idx_case_access_accessed_at ON sp_case_access(accessed_at);

-- ============================================================================
-- 8. CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Trigger already exists from previous migration, no need to recreate
