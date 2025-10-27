-- ServiceText Pro Database Updates
-- Run this script to create all new tables for smart matching, notifications, and reviews

-- ============================================================================
-- NOTIFICATIONS SYSTEM TABLES
-- ============================================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT, -- JSON data for additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add is_read column to existing notifications table (ignore error if column exists)
ALTER TABLE notifications ADD COLUMN is_read INTEGER DEFAULT 0;

-- Create indexes for notifications (user_id and created_at first)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- REVIEW SYSTEM TABLES
-- ============================================================================

-- Create case_reviews table
CREATE TABLE IF NOT EXISTS case_reviews (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    service_quality INTEGER CHECK (service_quality >= 1 AND service_quality <= 5),
    communication INTEGER CHECK (communication >= 1 AND communication <= 5),
    timeliness INTEGER CHECK (timeliness >= 1 AND timeliness <= 5),
    value_for_money INTEGER CHECK (value_for_money >= 1 AND value_for_money <= 5),
    would_recommend INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES marketplace_service_cases(id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (provider_id) REFERENCES users(id),
    UNIQUE(case_id, customer_id, provider_id)
);

-- Create indexes for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON case_reviews(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON case_reviews(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_case ON case_reviews(case_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON case_reviews(rating);

-- ============================================================================
-- UPDATE EXISTING TABLES FOR NEW FEATURES
-- ============================================================================

-- Add rating and review columns to service_provider_profiles table if they don't exist
ALTER TABLE service_provider_profiles ADD COLUMN response_time_hours INTEGER DEFAULT 24;
ALTER TABLE service_provider_profiles ADD COLUMN base_price REAL DEFAULT 0.0;
ALTER TABLE service_provider_profiles ADD COLUMN rating REAL DEFAULT 0.0;
ALTER TABLE service_provider_profiles ADD COLUMN total_reviews INTEGER DEFAULT 0;

-- Add missing columns to marketplace_service_cases if not exists
ALTER TABLE marketplace_service_cases ADD COLUMN customer_id TEXT;
ALTER TABLE marketplace_service_cases ADD COLUMN completion_notes TEXT;
ALTER TABLE marketplace_service_cases ADD COLUMN completed_at DATETIME;

-- ============================================================================
-- SMART MATCHING ENHANCEMENT DATA
-- ============================================================================

-- Update service_provider_profiles with sample data for smart matching
-- (You can customize these values based on your actual providers)

-- Update pricing data for existing providers (experience_years already exists)
UPDATE service_provider_profiles SET 
    response_time_hours = 2,
    base_price = 50.0
WHERE response_time_hours = 24;

-- ============================================================================
-- CHAT SESSIONS TABLE (if not already created)
-- ============================================================================

-- Create chat_sessions table for permanent chat access
CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT,
    sp_identifier TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (sp_identifier) REFERENCES service_provider_identifiers(identifier)
);

-- Create index for chat sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_sp_identifier ON chat_sessions(sp_identifier);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- ============================================================================
-- VERIFICATION AND DATA INTEGRITY
-- ============================================================================

-- Verify all tables exist
SELECT name FROM sqlite_master WHERE type='table' AND name IN (
    'notifications',
    'case_reviews', 
    'chat_sessions',
    'marketplace_service_cases',
    'service_provider_profiles',
    'users'
);

-- Show table counts
SELECT 
    'notifications' as table_name, COUNT(*) as count FROM notifications
UNION ALL
SELECT 
    'case_reviews' as table_name, COUNT(*) as count FROM case_reviews
UNION ALL
SELECT 
    'chat_sessions' as table_name, COUNT(*) as count FROM chat_sessions
UNION ALL
SELECT 
    'marketplace_service_cases' as table_name, COUNT(*) as count FROM marketplace_service_cases
UNION ALL
SELECT 
    'service_provider_profiles' as table_name, COUNT(*) as count FROM service_provider_profiles;

-- ============================================================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- ============================================================================

-- Insert sample notification types for testing
INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, data) 
SELECT 
    'test-notif-' || u.id,
    u.id,
    'welcome',
    'Добре дошли в ServiceText Pro!',
    'Благодарим ви, че се присъединихте към нашата платформа.',
    '{"source": "system"}'
FROM users u 
WHERE u.role IN ('customer', 'service_provider')
LIMIT 5;

PRAGMA foreign_keys = ON;

-- Create index on is_read column (after column is added)
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- End of database updates
