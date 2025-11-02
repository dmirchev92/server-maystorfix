-- Migration: Update Referral Rewards System
-- Description: Change reward structure to SMS-based and subscription tiers with aggregate tracking
-- Date: 2025-11-02

-- ============================================================================
-- 1. ADD is_aggregate COLUMN TO referral_rewards
-- ============================================================================

ALTER TABLE referral_rewards
ADD COLUMN IF NOT EXISTS is_aggregate BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. UPDATE EXISTING REWARDS (if any) TO NEW SYSTEM
-- ============================================================================

-- Mark all existing rewards as individual (not aggregate)
UPDATE referral_rewards
SET is_aggregate = FALSE
WHERE is_aggregate IS NULL;

-- ============================================================================
-- 3. ADD COMMENT TO CLARIFY REWARD TYPES
-- ============================================================================

COMMENT ON COLUMN referral_rewards.reward_type IS 'Reward types: sms_30 (30 SMS), free_normal_month (1 month Normal plan), free_pro_month (1 month Pro plan)';
COMMENT ON COLUMN referral_rewards.is_aggregate IS 'FALSE for individual referral rewards (50 clicks = 30 SMS), TRUE for aggregate rewards (250/500 clicks = free months)';
COMMENT ON COLUMN referral_rewards.referral_id IS 'NULL for aggregate rewards, specific referral ID for individual rewards';

-- ============================================================================
-- 4. CREATE INDEX FOR AGGREGATE QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_referral_rewards_aggregate ON referral_rewards(referrer_user_id, is_aggregate, reward_type);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- New Reward Structure:
-- Individual: 1 referral reaches 50 clicks → 30 SMS
-- Aggregate: 5 referrals each with 50+ clicks (250 total) → 1 month Normal plan
-- Aggregate: 10 referrals each with 50+ clicks (500 total) → 1 month Pro plan
