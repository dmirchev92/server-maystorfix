-- SMS Verification System for Registration
-- Users must verify their phone number via SMS code before completing registration

-- Create SMS verification codes table
CREATE TABLE IF NOT EXISTS sms_verification_codes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  ip_address TEXT
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sms_verification_phone ON sms_verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_verification_expires ON sms_verification_codes(expires_at);

-- Add phone_verified flag to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Mark existing users as verified (legacy users)
UPDATE users 
SET phone_verified = TRUE 
WHERE phone_number IS NOT NULL;

-- Log the changes
SELECT 'SMS verification system created successfully' as status;
