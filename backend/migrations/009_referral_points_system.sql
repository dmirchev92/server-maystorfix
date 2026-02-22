-- Migration: Update Referral System to Points-Based Rewards
-- Date: 2024-11-29
-- 
-- New Referral Rewards:
-- 1. When someone refers a new SP → Both referrer AND referred get 5 points
-- 2. When referred SP gets 50 clicks → Referrer gets 10 points
-- 3. When 5 referred people each get 50 clicks → Referrer gets 100 points bonus
--
-- Removes: SMS-based rewards (sms_30, free_normal_month, free_pro_month)

-- Update reward_type enum values for new system
-- Old types: 'sms_30', 'free_normal_month', 'free_pro_month'
-- New types: 'signup_bonus', 'referrer_signup_bonus', 'clicks_50_bonus', 'aggregate_5x50_bonus'

-- Add new columns if needed
ALTER TABLE referral_rewards 
ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 0;

ALTER TABLE referral_rewards 
ADD COLUMN IF NOT EXISTS referred_user_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred_user 
ON referral_rewards(referred_user_id);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_reward_type 
ON referral_rewards(reward_type);

-- Clean up old SMS-related columns (optional - keep for history)
-- ALTER TABLE referral_rewards DROP COLUMN IF EXISTS sms_sent;
-- ALTER TABLE referral_rewards DROP COLUMN IF EXISTS sms_sent_at;

-- Drop the referral_sms_claim_tokens table if exists (no longer needed)
-- DROP TABLE IF EXISTS referral_sms_claim_tokens;

COMMENT ON TABLE referral_rewards IS 'Referral rewards using bidding points system. Reward types: signup_bonus (5pts to referred), referrer_signup_bonus (5pts to referrer), clicks_50_bonus (10pts at 50 clicks), aggregate_5x50_bonus (100pts when 5 referrals reach 50 clicks each)';
