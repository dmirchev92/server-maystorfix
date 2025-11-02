-- Migration: Add SMS Reward Claim System
-- Description: One-time use tokens for claiming 30 SMS rewards
-- Date: 2025-11-02

-- ============================================================================
-- 1. CREATE SMS REWARD CLAIM TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS referral_sms_claim_tokens (
  id TEXT PRIMARY KEY,
  referral_id TEXT NOT NULL REFERENCES sp_referrals(id),
  reward_id TEXT NOT NULL REFERENCES referral_rewards(id),
  referrer_user_id TEXT NOT NULL REFERENCES users(id), -- Person who gets the reward (30 SMS)
  token TEXT UNIQUE NOT NULL,                          -- One-time use token
  sms_amount INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending',              -- 'pending', 'claimed', 'expired'
  created_at TIMESTAMP DEFAULT NOW(),
  claimed_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,                       -- 7 days from creation
  CONSTRAINT valid_status CHECK (status IN ('pending', 'claimed', 'expired'))
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sms_claim_tokens_token ON referral_sms_claim_tokens(token);
CREATE INDEX IF NOT EXISTS idx_sms_claim_tokens_referrer ON referral_sms_claim_tokens(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_sms_claim_tokens_status ON referral_sms_claim_tokens(status);

-- ============================================================================
-- 3. ADD COLUMN TO TRACK IF SMS WAS SENT
-- ============================================================================

ALTER TABLE referral_rewards
ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE referral_rewards
ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMP;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE referral_sms_claim_tokens IS 'One-time use tokens for claiming 30 SMS referral rewards';
