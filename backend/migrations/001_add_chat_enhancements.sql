-- Migration: Add chat system enhancements
-- Description: Add new columns and tables for professional chat system
-- Date: 2025-10-25

-- ==================== ENHANCE EXISTING TABLES ====================

-- Add new columns to marketplace_chat_messages
ALTER TABLE marketplace_chat_messages 
  ADD COLUMN IF NOT EXISTS sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_user 
  ON marketplace_chat_messages(sender_user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent 
  ON marketplace_chat_messages(conversation_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_deleted 
  ON marketplace_chat_messages(deleted_at) 
  WHERE deleted_at IS NOT NULL;

-- ==================== NEW TABLES ====================

-- Participants table (for future multi-participant support)
CREATE TABLE IF NOT EXISTS marketplace_chat_participants (
  conversation_id TEXT NOT NULL REFERENCES marketplace_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'provider', 'admin')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_read_message_id TEXT,
  settings JSONB DEFAULT '{}',
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_user 
  ON marketplace_chat_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_participants_conversation 
  ON marketplace_chat_participants(conversation_id);

-- Receipts table (delivery and read receipts)
CREATE TABLE IF NOT EXISTS marketplace_chat_receipts (
  message_id TEXT NOT NULL REFERENCES marketplace_chat_messages(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('delivered', 'read')),
  at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_message 
  ON marketplace_chat_receipts(message_id);

CREATE INDEX IF NOT EXISTS idx_receipts_recipient 
  ON marketplace_chat_receipts(recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_receipts_status 
  ON marketplace_chat_receipts(status);

-- Attachments table
CREATE TABLE IF NOT EXISTS marketplace_chat_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES marketplace_chat_messages(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  width INTEGER,
  height INTEGER,
  thumb_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attachments_message 
  ON marketplace_chat_attachments(message_id);

-- ==================== DATA BACKFILL ====================

-- Backfill sender_user_id for existing messages
-- This maps sender_type to actual user_id from the conversation

-- For provider messages
UPDATE marketplace_chat_messages m
SET sender_user_id = c.provider_id
FROM marketplace_conversations c
WHERE m.conversation_id = c.id
  AND m.sender_type = 'provider'
  AND m.sender_user_id IS NULL;

-- For customer messages
UPDATE marketplace_chat_messages m
SET sender_user_id = c.customer_id
FROM marketplace_conversations c
WHERE m.conversation_id = c.id
  AND m.sender_type = 'customer'
  AND m.sender_user_id IS NULL
  AND c.customer_id IS NOT NULL;

-- ==================== BACKFILL PARTICIPANTS ====================

-- Add provider participants
INSERT INTO marketplace_chat_participants (conversation_id, user_id, role)
SELECT DISTINCT 
  id as conversation_id,
  provider_id as user_id,
  'provider' as role
FROM marketplace_conversations
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- Add customer participants (where customer_id exists)
INSERT INTO marketplace_chat_participants (conversation_id, user_id, role)
SELECT DISTINCT 
  id as conversation_id,
  customer_id as user_id,
  'customer' as role
FROM marketplace_conversations
WHERE customer_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- ==================== VERIFICATION ====================

-- Verify migration
DO $$
DECLARE
  total_messages INTEGER;
  backfilled_messages INTEGER;
  total_conversations INTEGER;
  total_participants INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_messages FROM marketplace_chat_messages;
  SELECT COUNT(*) INTO backfilled_messages FROM marketplace_chat_messages WHERE sender_user_id IS NOT NULL;
  SELECT COUNT(*) INTO total_conversations FROM marketplace_conversations;
  SELECT COUNT(*) INTO total_participants FROM marketplace_chat_participants;
  
  RAISE NOTICE 'Migration completed successfully:';
  RAISE NOTICE '  Total messages: %', total_messages;
  RAISE NOTICE '  Backfilled messages: %', backfilled_messages;
  RAISE NOTICE '  Total conversations: %', total_conversations;
  RAISE NOTICE '  Total participants: %', total_participants;
END $$;
