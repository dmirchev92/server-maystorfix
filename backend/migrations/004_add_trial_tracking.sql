-- Add trial tracking fields for FREE tier users (Service Providers)
-- Trial limits: 5 case ACCEPTANCES OR 14 days, whichever comes first
-- Note: SPs accept cases from customers, they don't create them

-- Add trial tracking columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_cases_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_expired BOOLEAN DEFAULT FALSE;

-- Set trial_started_at for existing FREE tier users (tradesperson only)
UPDATE users 
SET trial_started_at = created_at,
    trial_cases_used = 0,
    trial_expired = FALSE
WHERE role = 'tradesperson' 
  AND subscription_tier_id = 'free' 
  AND trial_started_at IS NULL;

-- Create index for faster trial status checks
CREATE INDEX IF NOT EXISTS idx_users_trial_status 
ON users(subscription_tier_id, trial_expired, trial_started_at) 
WHERE role = 'tradesperson';

-- Verify the changes
SELECT 
    COUNT(*) as total_free_users,
    COUNT(CASE WHEN trial_started_at IS NOT NULL THEN 1 END) as users_with_trial,
    COUNT(CASE WHEN trial_expired = TRUE THEN 1 END) as expired_trials
FROM users 
WHERE role = 'tradesperson' AND subscription_tier_id = 'free';
