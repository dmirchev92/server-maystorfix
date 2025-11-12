-- Migration: Add chat source tracking
-- This adds chat_source field to track where chats originated from

-- Add chat_source to marketplace_conversations
ALTER TABLE marketplace_conversations 
ADD COLUMN IF NOT EXISTS chat_source VARCHAR(50) DEFAULT 'direct';

-- Add chat_source to marketplace_service_cases
ALTER TABLE marketplace_service_cases 
ADD COLUMN IF NOT EXISTS chat_source VARCHAR(50);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_chat_source ON marketplace_conversations(chat_source);
CREATE INDEX IF NOT EXISTS idx_service_cases_chat_source ON marketplace_service_cases(chat_source);

-- Add comments
COMMENT ON COLUMN marketplace_conversations.chat_source IS 'Source of chat: smschat, searchchat, direct, etc.';
COMMENT ON COLUMN marketplace_service_cases.chat_source IS 'Source of chat that created this case: smschat, searchchat, direct, etc.';
