-- Fix migration: Add missing columns to users table
-- This completes the subscription tier migration

-- Add subscription columns to users table (if not exists)
DO $$ 
BEGIN
    -- Add subscription_tier_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='subscription_tier_id') THEN
        ALTER TABLE users 
        ADD COLUMN subscription_tier_id TEXT REFERENCES subscription_tiers(id) DEFAULT 'free';
    END IF;

    -- Add subscription_status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='subscription_status') THEN
        ALTER TABLE users 
        ADD COLUMN subscription_status TEXT DEFAULT 'active';
    END IF;

    -- Add subscription_expires_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='subscription_expires_at') THEN
        ALTER TABLE users 
        ADD COLUMN subscription_expires_at TIMESTAMP WITHOUT TIME ZONE;
    END IF;
END $$;

-- Update existing tradesperson users to free tier
UPDATE users 
SET subscription_tier_id = 'free',
    subscription_status = 'active'
WHERE role = 'tradesperson' 
  AND (subscription_tier_id IS NULL OR subscription_tier_id = '');

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier_id ON users(subscription_tier_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Verify the setup
SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as total_users, subscription_tier_id, subscription_status 
FROM users 
WHERE role = 'tradesperson'
GROUP BY subscription_tier_id, subscription_status;
