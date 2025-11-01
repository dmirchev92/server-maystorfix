-- Fix MR92 user tier to NORMAL (as selected during registration)
-- This corrects the registration bug where tier wasn't being saved

UPDATE users 
SET subscription_tier_id = 'normal', 
    subscription_status = 'active',
    updated_at = NOW()
WHERE email = 'mr92@yahoo.com';

-- Verify the update
SELECT id, email, first_name, last_name, subscription_tier_id, subscription_status 
FROM users 
WHERE email = 'mr92@yahoo.com';
