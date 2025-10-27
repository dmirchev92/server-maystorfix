-- Chat Token System Database Tables
-- Creates tables for managing service provider identifiers and chat tokens

-- Service Provider Identifiers Table
-- Stores unique identifiers for each service provider (e.g., k1N_)
CREATE TABLE IF NOT EXISTS service_provider_identifiers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    identifier TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat Tokens Table
-- Stores dynamic tokens for chat sessions with automatic lifecycle management
CREATE TABLE IF NOT EXISTS chat_tokens (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    sp_identifier TEXT NOT NULL,
    is_used INTEGER DEFAULT 0,
    used_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    conversation_id TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sp_identifier) REFERENCES service_provider_identifiers(identifier) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sp_identifiers_user_id ON service_provider_identifiers(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_identifiers_identifier ON service_provider_identifiers(identifier);
CREATE INDEX IF NOT EXISTS idx_chat_tokens_user_id ON chat_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_tokens_token ON chat_tokens(token);
CREATE INDEX IF NOT EXISTS idx_chat_tokens_sp_identifier ON chat_tokens(sp_identifier);
CREATE INDEX IF NOT EXISTS idx_chat_tokens_unused ON chat_tokens(user_id, is_used, expires_at);
CREATE INDEX IF NOT EXISTS idx_chat_tokens_expires_at ON chat_tokens(expires_at);

-- Trigger to automatically clean up old tokens (optional)
-- This trigger removes tokens older than 30 days to prevent database bloat
CREATE TRIGGER IF NOT EXISTS cleanup_old_tokens
    AFTER INSERT ON chat_tokens
    BEGIN
        DELETE FROM chat_tokens 
        WHERE expires_at < datetime('now', '-30 days');
    END;
