-- Create a test FREE user whose trial will expire in 3 minutes
-- Current time: 2025-11-01 01:51 (GMT+3 = 2025-10-31 22:51 UTC)
-- Trial should expire at: 2025-11-01 01:54 GMT+3 (2025-10-31 22:54 UTC)
-- So trial_started_at should be: 14 days ago + 3 minutes from now
-- = 2025-10-17 22:51 UTC

-- Insert test user
INSERT INTO users (
  id, email, password_hash, role, status, public_id,
  first_name, last_name, phone_number,
  subscription_tier_id, subscription_status,
  trial_started_at, trial_cases_used, trial_expired,
  data_retention_until, is_gdpr_compliant,
  created_at, updated_at
) VALUES (
  'test-expiring-user-001',
  'expiring@test.com',
  '$2a$12$dummy.hash.for.testing',
  'tradesperson',
  'active',
  'EXP001',
  'Test',
  'Expiring',
  '+359888999001',
  'free',
  'active',
  NOW() - INTERVAL '14 days' + INTERVAL '3 minutes',  -- Will expire in 3 minutes
  2,  -- Has used 2 cases so far
  FALSE,
  NOW() + INTERVAL '2 years',
  TRUE,
  NOW() - INTERVAL '14 days',
  NOW()
);

-- Create SMS settings for this user (enabled)
INSERT INTO sms_settings (
  id, user_id, is_enabled, sent_count,
  created_at, updated_at
) VALUES (
  'test-sms-settings-001',
  'test-expiring-user-001',
  TRUE,  -- SMS is currently ON
  0,
  NOW(),
  NOW()
);

-- Verify the user
SELECT 
  email,
  trial_started_at,
  NOW() as current_time,
  EXTRACT(EPOCH FROM (NOW() - trial_started_at)) / 86400 as days_elapsed,
  14 - (EXTRACT(EPOCH FROM (NOW() - trial_started_at)) / 86400) as days_remaining,
  trial_cases_used,
  trial_expired
FROM users 
WHERE email = 'expiring@test.com';

-- Verify SMS is ON
SELECT user_id, is_enabled as sms_enabled
FROM sms_settings
WHERE user_id = 'test-expiring-user-001';
