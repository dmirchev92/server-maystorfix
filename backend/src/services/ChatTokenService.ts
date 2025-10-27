// Chat Token Service - Manages unique tokens for service provider chat sessions
// Implements automatic token lifecycle with 7-day expiration and pre-generation

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';
import { ServiceTextProError } from '../types';

export interface ChatToken {
  id: string;
  token: string;
  userId: string;
  spIdentifier: string;
  isUsed: boolean;
  usedAt?: Date;
  createdAt: Date;
  expiresAt: Date;
  conversationId?: string;
}

export interface ServiceProviderIdentifier {
  id: string;
  userId: string;
  identifier: string;
  createdAt: Date;
}

export class ChatTokenService {
  private readonly database: any; // DatabaseFactory returns SQLiteDatabase | PostgreSQLDatabase
  private readonly expirationDays: number = 7;

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return uuidv4();
  }

  constructor() {
    this.database = DatabaseFactory.getDatabase();
  }

  /**
   * Initialize chat token system for a user
   * Creates SP identifier and first token if they don't exist
   */
  async initializeForUser(userId: string): Promise<{ spIdentifier: string; currentToken: string }> {
    try {
      // Get or create SP identifier
      let spIdentifier = await this.getOrCreateServiceProviderIdentifier(userId);
      if (!spIdentifier) {
        throw new ServiceTextProError('Failed to get or create SP identifier', 'SP_IDENTIFIER_FAILED', 500);
      }

      // Ensure there's always an unused token ready
      let currentToken = await this.getCurrentUnusedToken(userId, spIdentifier);
      if (!currentToken) {
        currentToken = await this.generateNewToken(userId, spIdentifier);
      }

      logger.info('Chat token system initialized', {
        userId,
        spIdentifier,
        currentToken: currentToken.substring(0, 4) + '****'
      });

      return { spIdentifier, currentToken };
    } catch (error) {
      logger.error('Failed to initialize chat token system', { userId, error });
      throw error;
    }
  }

  /**
   * Get or create unique service provider identifier
   */
  private async getOrCreateServiceProviderIdentifier(userId: string): Promise<string> {
    try {
      const result = await new Promise<any[]>((resolve, reject) => {
        (this.database as any).db.all(
          'SELECT identifier FROM service_provider_identifiers WHERE user_id = ?',
          [userId],
          (err: any, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
      if (result.length > 0) {
        return result[0].identifier;
      } else {
        return await this.createServiceProviderIdentifier(userId);
      }
    } catch (error) {
      logger.error('Failed to get or create SP identifier', { userId, error });
      throw new ServiceTextProError('Failed to get or create SP identifier', 'SP_IDENTIFIER_FAILED', 500);
    }
  }

  /**
   * Create unique service provider identifier
   */
  private async createServiceProviderIdentifier(userId: string): Promise<string> {
    let identifier: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      identifier = this.generateServiceProviderIdentifier();
      attempts++;

      // Check if identifier already exists
      const existing = await new Promise<any[]>((resolve, reject) => {
        (this.database as any).db.all(
          'SELECT id FROM service_provider_identifiers WHERE identifier = ?',
          [identifier],
          (err: any, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      if (existing.length === 0) {
        // Identifier is unique, save it
        await new Promise<void>((resolve, reject) => {
          (this.database as any).db.run(
            'INSERT INTO service_provider_identifiers (id, user_id, identifier) VALUES (?, ?, ?)',
            [this.generateId(), userId, identifier],
            (err: any) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        logger.info('Created SP identifier', { userId, identifier });
        return identifier;
      }
    } while (attempts < maxAttempts);

    throw new ServiceTextProError('Failed to generate unique SP identifier', 'IDENTIFIER_GENERATION_FAILED', 500);
  }

  /**
   * Generate service provider identifier (e.g., k1N_)
   */
  private generateServiceProviderIdentifier(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let identifier = '';
    
    for (let i = 0; i < 3; i++) {
      identifier += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return identifier + '_';
  }

  /**
   * Get current unused token for user
   */
  async getCurrentUnusedToken(userId: string, spIdentifier: string): Promise<string | null> {
    try {
      const result = await new Promise<any[]>((resolve, reject) => {
        (this.database as any).db.all(
          'SELECT token FROM chat_tokens WHERE sp_identifier = ? AND is_used = FALSE AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1',
          [spIdentifier],
          (err: any, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
      return result.length > 0 ? result[0].token : null;
    } catch (error) {
      logger.error('Failed to get current unused token', { userId, error });
      return null;
    }
  }

  /**
   * Generate new chat token
   */
  async generateNewToken(userId: string, spIdentifier: string): Promise<string> {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.expirationDays * 24 * 60 * 60 * 1000);

    try {
      await new Promise<void>((resolve, reject) => {
        (this.database as any).db.run(
          'INSERT INTO chat_tokens (id, user_id, sp_identifier, token, is_used, expires_at) VALUES (?, ?, ?, ?, FALSE, CURRENT_TIMESTAMP + INTERVAL \'7 days\')',
          [this.generateId(), userId, spIdentifier, token],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      logger.info('Generated new chat token', {
        userId,
        spIdentifier,
        token: token.substring(0, 4) + '****',
        expiresAt
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate new token', { userId, error });
      throw new ServiceTextProError('Failed to generate chat token', 'TOKEN_GENERATION_FAILED', 500);
    }
  }

  /**
   * Generate cryptographically secure random token
   */
  private generateSecureToken(): string {
    const crypto = require('crypto');
    
    // Generate 12 random bytes and convert to base36 for alphanumeric token
    // This provides much higher entropy than Math.random()
    const randomBytes = crypto.randomBytes(12);
    
    // Convert to alphanumeric string (0-9, A-Z)
    let token = '';
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    for (let i = 0; i < randomBytes.length; i++) {
      token += chars[randomBytes[i] % chars.length];
    }
    
    // Ensure exactly 12 characters for consistency
    return token.substring(0, 12);
  }

  /**
   * Validate and use a chat token
   */
  async validateAndUseToken(spIdentifier: string, token: string): Promise<{
    isValid: boolean;
    userId?: string;
    conversationId?: string;
    sessionId?: string;
    error?: string;
  }> {
    try {
      // Skip SQLite-specific checks for PostgreSQL
      // Just proceed with the actual query

      // Find the token with simpler query
      const result = await new Promise<any[]>((resolve, reject) => {
        (this.database as any).db.all(
          `SELECT * FROM chat_tokens 
           WHERE sp_identifier = ? AND token = ?`,
          [spIdentifier, token],
          (err: any, rows: any[]) => {
            if (err) {
              logger.error('SQL error in validateAndUseToken', { 
                error: err, 
                spIdentifier, 
                token: token.substring(0, 4) + '****',
                query: 'SELECT * FROM chat_tokens WHERE sp_identifier = ? AND token = ?',
                params: [spIdentifier, token.substring(0, 4) + '****']
              });
              reject(err);
            } else {
              logger.info('Query result', { foundRows: rows.length, firstRow: rows[0] });
              resolve(rows || []);
            }
          }
        );
      });

      if (result.length === 0) {
        return { isValid: false, error: 'Token not found' };
      }

      const tokenData = result[0];

      // Check if token is already used
      if (tokenData.is_used) {
        return { isValid: false, error: 'Token already used' };
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        return { isValid: false, error: 'Token expired' };
      }

      // Mark token as used and create conversation
      const conversationId = uuidv4();
      const sessionId = uuidv4();
      
      await new Promise<void>((resolve, reject) => {
        (this.database as any).db.run(
          'UPDATE chat_tokens SET is_used = TRUE, used_at = CURRENT_TIMESTAMP, conversation_id = ? WHERE sp_identifier = ? AND token = ?',
          [conversationId, spIdentifier, token],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create marketplace conversation record
      await new Promise<void>((resolve, reject) => {
        (this.database as any).db.run(
          'INSERT INTO marketplace_conversations (id, provider_id, customer_name, customer_email, customer_phone, status, created_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [conversationId, tokenData.user_id, 'Chat Customer', '', '', 'active'],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create permanent chat session
      await new Promise<void>((resolve, reject) => {
        (this.database as any).db.run(
          'INSERT INTO chat_sessions (session_id, conversation_id, user_id, sp_identifier) VALUES (?, ?, ?, ?)',
          [sessionId, conversationId, tokenData.user_id, spIdentifier],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Generate new token for next customer
      await this.generateNewToken(tokenData.user_id, spIdentifier);

      logger.info('Token validated and used', {
        userId: tokenData.user_id,
        spIdentifier,
        token: token.substring(0, 4) + '****',
        conversationId,
        sessionId
      });

      return {
        isValid: true,
        userId: tokenData.user_id,
        conversationId,
        sessionId
      };

    } catch (error) {
      logger.error('Failed to validate token', { spIdentifier, token: token.substring(0, 4) + '****', error });
      return { isValid: false, error: 'Internal server error' };
    }
  }

  /**
   * Validate a chat session
   */
  async validateSession(sessionId: string): Promise<{
    isValid: boolean;
    userId?: string;
    conversationId?: string;
    spIdentifier?: string;
    error?: string;
  }> {
    try {
      const result = await new Promise<any[]>((resolve, reject) => {
        (this.database as any).db.all(
          'SELECT * FROM chat_sessions WHERE session_id = ?',
          [sessionId],
          (err: any, rows: any[]) => {
            if (err) {
              logger.error('SQL error in validateSession', { error: err, sessionId });
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      if (result.length === 0) {
        return { isValid: false, error: 'Session not found' };
      }

      const sessionData = result[0];

      // Update last accessed time
      await new Promise<void>((resolve, reject) => {
        (this.database as any).db.run(
          'UPDATE chat_sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?',
          [sessionId],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      logger.info('Session validated', {
        sessionId,
        userId: sessionData.user_id,
        conversationId: sessionData.conversation_id,
        spIdentifier: sessionData.sp_identifier
      });

      return {
        isValid: true,
        userId: sessionData.user_id,
        conversationId: sessionData.conversation_id,
        spIdentifier: sessionData.sp_identifier
      };

    } catch (error) {
      logger.error('Failed to validate session', { sessionId, error });
      return { isValid: false, error: 'Internal server error' };
    }
  }

  /**
   * Get chat URL for service provider
   */
  async getChatUrlForUser(userId: string, baseUrl?: string): Promise<string> {
    const { spIdentifier, currentToken } = await this.initializeForUser(userId);
    const url = baseUrl || process.env.FRONTEND_URL || 'https://maystorfix.com';
    return `${url}/u/${spIdentifier}/c/${currentToken}`;
  }

  /**
   * Get current token for SMS template
   */
  async getCurrentTokenForSMS(userId: string): Promise<string> {
    const spIdentifier = await this.getOrCreateServiceProviderIdentifier(userId);
    if (!spIdentifier) {
      throw new ServiceTextProError('Service provider not initialized', 'SP_NOT_INITIALIZED', 400);
    }
    
    const currentToken = await this.getCurrentUnusedToken(userId, spIdentifier);
    if (!currentToken) {
      // Generate new token if none exists
      return await this.generateNewToken(userId, spIdentifier);
    }
    return currentToken;
  }

  /**
   * Force regenerate token - invalidates current unused token and creates new one
   */
  async forceRegenerateToken(userId: string): Promise<{ newToken: string; chatUrl: string }> {
    try {
      const spIdentifier = await this.getOrCreateServiceProviderIdentifier(userId);
      if (!spIdentifier) {
        throw new ServiceTextProError('Service provider not initialized', 'SP_NOT_INITIALIZED', 400);
      }

      // Mark any existing unused tokens as expired/used
      await new Promise<void>((resolve, reject) => {
        (this.database as any).db.run(
          'UPDATE chat_tokens SET is_used = TRUE, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND sp_identifier = ? AND is_used = FALSE',
          [userId, spIdentifier],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Generate new token
      const newToken = await this.generateNewToken(userId, spIdentifier);
      const chatUrl = await this.getChatUrlForUser(userId);

      logger.info('Token force regenerated', {
        userId,
        spIdentifier,
        newToken: newToken.substring(0, 4) + '****'
      });

      return { newToken, chatUrl };
    } catch (error) {
      logger.error('Failed to force regenerate token', { userId, error });
      throw error;
    }
  }

  /**
   * Clean up expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await new Promise<{changes: number}>((resolve, reject) => {
        (this.database as any).db.run(
          `DELETE FROM chat_tokens 
           WHERE expires_at < CURRENT_TIMESTAMP OR 
                 (is_used = TRUE AND used_at < CURRENT_TIMESTAMP - INTERVAL '1 day')`,
          (err: any) => {
            if (err) reject(err);
            else resolve({changes: (this.database as any).db.changes || 0});
          }
        );
      });

      const deletedCount = result.changes || 0;
      if (deletedCount > 0) {
        logger.info('Cleaned up expired tokens', { deletedCount });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', { error });
      return 0;
    }
  }

  /**
   * Get token statistics for user
   */
  async getTokenStats(userId: string): Promise<{
    totalGenerated: number;
    currentUnused: number;
    totalUsed: number;
    totalExpired: number;
  }> {
    try {
      const stats = await new Promise<any[]>((resolve, reject) => {
        (this.database as any).db.all(
          `SELECT 
             COUNT(*) as total_tokens,
             COUNT(CASE WHEN is_used = TRUE THEN 1 END) as used_tokens,
             COUNT(CASE WHEN is_used = FALSE AND expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_tokens,
             COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_tokens
           FROM chat_tokens ct
           JOIN service_provider_identifiers spi ON ct.sp_identifier = spi.identifier
           WHERE spi.user_id = ?`,
          [userId],
          (err: any, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      return {
        totalGenerated: stats[0]?.total_tokens || 0,
        currentUnused: stats[0]?.active_tokens || 0,
        totalUsed: stats[0]?.used_tokens || 0,
        totalExpired: stats[0]?.expired_tokens || 0
      };
    } catch (error) {
      logger.error('Failed to get token stats', { userId, error });
      return { totalGenerated: 0, currentUnused: 0, totalUsed: 0, totalExpired: 0 };
    }
  }
}
