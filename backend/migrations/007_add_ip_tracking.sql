-- Simple IP-based trial abuse prevention
-- Rule: Only 1 FREE account per IP address

-- Add registration IP to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS registration_ip TEXT;

-- Create index for fast IP lookups
CREATE INDEX IF NOT EXISTS idx_users_registration_ip ON users(registration_ip);

-- Update existing FREE users with a placeholder IP
UPDATE users 
SET registration_ip = 'legacy-user'
WHERE role = 'tradesperson' 
  AND subscription_tier_id = 'free'
  AND registration_ip IS NULL;

-- Log the changes
SELECT 'IP-based trial abuse prevention added successfully' as status;
