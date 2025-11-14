-- Migration: Create missed_calls table for persistent call tracking
-- This prevents data loss when mobile app is rebuilt
-- GDPR Compliant: Data stored for legitimate business interest (service delivery)
-- Retention: 90 days (configurable), automatic cleanup via scheduled job
-- User Rights: Full access, deletion, and export capabilities provided via API

CREATE TABLE IF NOT EXISTS missed_calls (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,  -- Encrypted in production
  timestamp BIGINT NOT NULL,
  formatted_time TEXT,
  duration INTEGER DEFAULT 0,
  call_type TEXT DEFAULT 'missed',
  sms_sent BOOLEAN DEFAULT FALSE,
  sms_sent_at TIMESTAMP,
  ai_response_sent BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- GDPR fields
  data_retention_until TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
  user_consented BOOLEAN DEFAULT TRUE,  -- Implied consent through service usage
  legal_basis TEXT DEFAULT 'legitimate_interest',  -- or 'contract'
  deleted_at TIMESTAMP,  -- Soft delete for audit trail
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_missed_calls_user_id ON missed_calls(user_id);

-- Create index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_missed_calls_timestamp ON missed_calls(timestamp DESC);

-- Create index for user + timestamp queries (most common)
CREATE INDEX IF NOT EXISTS idx_missed_calls_user_timestamp ON missed_calls(user_id, timestamp DESC);

-- Create index for GDPR cleanup queries
CREATE INDEX IF NOT EXISTS idx_missed_calls_retention ON missed_calls(data_retention_until) WHERE deleted_at IS NULL;

-- GDPR Compliance: Automatic cleanup query (run daily via cron/scheduler)
-- DELETE FROM missed_calls WHERE data_retention_until < CURRENT_TIMESTAMP AND deleted_at IS NULL;
