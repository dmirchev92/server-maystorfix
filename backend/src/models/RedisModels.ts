// Redis Database Models
// Caching, sessions, real-time data, and temporary storage

import Redis, { RedisOptions } from 'ioredis';
import config from '../utils/config';
import logger, { gdprLogger } from '../utils/logger';
import {
  User,
  Conversation,
  MessagePlatform
} from '../types';

export interface CachedUser {
  id: string;
  email: string;
  role: string;
  businessId?: string;
  isGdprCompliant: boolean;
  cachedAt: number;
  expiresAt: number;
}

export interface UserSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
  createdAt: number;
  lastUsedAt: number;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export interface ConversationState {
  conversationId: string;
  businessId: string;
  customerPhone: string;
  platform: MessagePlatform;
  state: ConversationState;
  lastActivity: number;
  contextData: Record<string, any>;
  aiAnalysisInProgress: boolean;
}

export interface RateLimitData {
  requests: number;
  windowStart: number;
  windowEnd: number;
  blocked: boolean;
}

export class RedisDatabase {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private isConnected: boolean = false;

  // Key prefixes for different data types
  private readonly prefixes = {
    USER_CACHE: 'user:cache:',
    USER_SESSION: 'session:',
    CONVERSATION_STATE: 'conv:state:',
    RATE_LIMIT: 'rate:',
    PASSWORD_RESET: 'pwd:reset:',
    EMAIL_VERIFICATION: 'email:verify:',
    ANALYTICS_CACHE: 'analytics:cache:',
    TEMPLATE_CACHE: 'template:cache:',
    BUSINESS_CACHE: 'business:cache:',
    REAL_TIME_DATA: 'realtime:',
    GDPR_PROCESSING: 'gdpr:process:',
    AI_ANALYSIS: 'ai:analysis:',
    NOTIFICATION_QUEUE: 'notify:queue:',
    WEBHOOK_CACHE: 'webhook:cache:'
  };

  constructor() {
    const redisConfig: RedisOptions = {
      host: config.database.redis.host,
      port: config.database.redis.port,
      password: config.database.redis.password,
      db: config.database.redis.db,
      // retryDelayOnFailover: 100, // Removed - not supported in this Redis version
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4
    };

    this.client = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis client connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { error: (error as Error).message });
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.info('Redis client connection closed');
    });

    this.subscriber.on('message', (channel, message) => {
      this.handleRealtimeMessage(channel, message);
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);

      // Subscribe to real-time channels
      await this.subscriber.subscribe(
        'conversation:updates',
        'user:notifications',
        'system:alerts',
        'analytics:realtime'
      );

      this.isConnected = true;
      logger.info('Redis connected successfully');

    } catch (error) {
      logger.error('Failed to connect to Redis', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * User caching operations
   */
  async cacheUser(user: User, ttlSeconds: number = 3600): Promise<void> {
    try {
      const cachedUser: CachedUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        businessId: user.businessId,
        isGdprCompliant: user.isGdprCompliant,
        cachedAt: Date.now(),
        expiresAt: Date.now() + (ttlSeconds * 1000)
      };

      await this.client.setex(
        `${this.prefixes.USER_CACHE}${user.id}`,
        ttlSeconds,
        JSON.stringify(cachedUser)
      );

      // Also cache by email for login lookups
      await this.client.setex(
        `${this.prefixes.USER_CACHE}email:${user.email}`,
        ttlSeconds,
        user.id
      );

      logger.debug('User cached successfully', { userId: user.id });

    } catch (error) {
      logger.error('Failed to cache user', { error: (error as Error).message, userId: user.id });
    }
  }

  async getCachedUser(userId: string): Promise<CachedUser | null> {
    try {
      const cached = await this.client.get(`${this.prefixes.USER_CACHE}${userId}`);
      if (!cached) return null;

      const user: CachedUser = JSON.parse(cached);
      
      // Check if cache is expired
      if (user.expiresAt < Date.now()) {
        await this.client.del(`${this.prefixes.USER_CACHE}${userId}`);
        return null;
      }

      return user;

    } catch (error) {
      logger.error('Failed to get cached user', { error: (error as Error).message, userId });
      return null;
    }
  }

  async getCachedUserByEmail(email: string): Promise<string | null> {
    try {
      return await this.client.get(`${this.prefixes.USER_CACHE}email:${email}`);
    } catch (error) {
      logger.error('Failed to get cached user by email', { error: (error as Error).message, email });
      return null;
    }
  }

  async invalidateUserCache(userId: string, email?: string): Promise<void> {
    try {
      const keys = [`${this.prefixes.USER_CACHE}${userId}`];
      if (email) {
        keys.push(`${this.prefixes.USER_CACHE}email:${email}`);
      }

      await this.client.del(...keys);
      logger.debug('User cache invalidated', { userId });

    } catch (error) {
      logger.error('Failed to invalidate user cache', { error: (error as Error).message, userId });
    }
  }

  /**
   * Session management
   */
  async createSession(session: UserSession): Promise<void> {
    try {
      const sessionKey = `${this.prefixes.USER_SESSION}${session.id}`;
      const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);

      await this.client.setex(
        sessionKey,
        ttl,
        JSON.stringify(session)
      );

      // Also index by user ID for session management
      await this.client.sadd(`${this.prefixes.USER_SESSION}user:${session.userId}`, session.id);
      await this.client.expire(`${this.prefixes.USER_SESSION}user:${session.userId}`, ttl);

      // Log session creation for GDPR audit
      gdprLogger.logDataAccess(
        session.userId,
        'session_creation',
        'user_authentication',
        session.ipAddress
      );

      logger.debug('Session created', { sessionId: session.id, userId: session.userId });

    } catch (error) {
      logger.error('Failed to create session', { error: (error as Error).message, sessionId: session.id });
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    try {
      const session = await this.client.get(`${this.prefixes.USER_SESSION}${sessionId}`);
      if (!session) return null;

      const sessionData: UserSession = JSON.parse(session);
      
      // Check if session is expired
      if (sessionData.expiresAt < Date.now()) {
        await this.invalidateSession(sessionId);
        return null;
      }

      // Update last used timestamp
      sessionData.lastUsedAt = Date.now();
      await this.client.setex(
        `${this.prefixes.USER_SESSION}${sessionId}`,
        Math.floor((sessionData.expiresAt - Date.now()) / 1000),
        JSON.stringify(sessionData)
      );

      return sessionData;

    } catch (error) {
      logger.error('Failed to get session', { error: (error as Error).message, sessionId });
      return null;
    }
  }

  async invalidateSession(sessionId: string): Promise<void> {
    try {
      // Get session to find user ID
      const session = await this.client.get(`${this.prefixes.USER_SESSION}${sessionId}`);
      if (session) {
        const sessionData: UserSession = JSON.parse(session);
        await this.client.srem(`${this.prefixes.USER_SESSION}user:${sessionData.userId}`, sessionId);
        
        // Log session invalidation
        gdprLogger.logDataAccess(
          sessionData.userId,
          'session_invalidation',
          'user_logout'
        );
      }

      await this.client.del(`${this.prefixes.USER_SESSION}${sessionId}`);
      logger.debug('Session invalidated', { sessionId });

    } catch (error) {
      logger.error('Failed to invalidate session', { error: (error as Error).message, sessionId });
    }
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      const sessionIds = await this.client.smembers(`${this.prefixes.USER_SESSION}user:${userId}`);
      
      if (sessionIds.length > 0) {
        const sessionKeys = sessionIds.map(id => `${this.prefixes.USER_SESSION}${id}`);
        await this.client.del(...sessionKeys, `${this.prefixes.USER_SESSION}user:${userId}`);
        
        // Log mass session invalidation
        gdprLogger.logDataAccess(
          userId,
          'all_sessions_invalidation',
          'security_action'
        );
      }

      logger.debug('All user sessions invalidated', { userId, count: sessionIds.length });

    } catch (error) {
      logger.error('Failed to invalidate all user sessions', { error: (error as Error).message, userId });
    }
  }

  /**
   * Rate limiting
   */
  async checkRateLimit(
    identifier: string,
    windowMs: number,
    maxRequests: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const key = `${this.prefixes.RATE_LIMIT}${identifier}`;
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const windowEnd = windowStart + windowMs;

      // Get current rate limit data
      const current = await this.client.get(key);
      let rateLimitData: RateLimitData;

      if (current) {
        rateLimitData = JSON.parse(current);
        
        // Reset if we're in a new window
        if (rateLimitData.windowStart !== windowStart) {
          rateLimitData = {
            requests: 0,
            windowStart,
            windowEnd,
            blocked: false
          };
        }
      } else {
        rateLimitData = {
          requests: 0,
          windowStart,
          windowEnd,
          blocked: false
        };
      }

      // Check if request is allowed
      const allowed = rateLimitData.requests < maxRequests;
      
      if (allowed) {
        rateLimitData.requests++;
      } else {
        rateLimitData.blocked = true;
      }

      // Save updated rate limit data
      const ttl = Math.ceil((windowEnd - now) / 1000);
      await this.client.setex(key, ttl, JSON.stringify(rateLimitData));

      return {
        allowed,
        remaining: Math.max(0, maxRequests - rateLimitData.requests),
        resetTime: windowEnd
      };

    } catch (error) {
      logger.error('Rate limit check failed', { error: (error as Error).message, identifier });
      // Allow request if rate limiting fails
      return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowMs };
    }
  }

  /**
   * Conversation state management
   */
  async setConversationState(conversationId: string, state: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      await this.client.setex(
        `${this.prefixes.CONVERSATION_STATE}${conversationId}`,
        ttlSeconds,
        JSON.stringify({
          ...state,
          lastActivity: Date.now()
        })
      );

      // Publish real-time update
      await this.publisher.publish('conversation:updates', JSON.stringify({
        type: 'state_updated',
        conversationId,
        state: state.state,
        timestamp: Date.now()
      }));

      logger.debug('Conversation state updated', { conversationId });

    } catch (error) {
      logger.error('Failed to set conversation state', { error: (error as Error).message, conversationId });
    }
  }

  async getConversationState(conversationId: string): Promise<any | null> {
    try {
      const state = await this.client.get(`${this.prefixes.CONVERSATION_STATE}${conversationId}`);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      logger.error('Failed to get conversation state', { error: (error as Error).message, conversationId });
      return null;
    }
  }

  /**
   * Password reset tokens
   */
  async setPasswordResetToken(userId: string, token: string, ttlSeconds: number = 3600): Promise<void> {
    try {
      await this.client.setex(
        `${this.prefixes.PASSWORD_RESET}${token}`,
        ttlSeconds,
        JSON.stringify({
          userId,
          token,
          createdAt: Date.now(),
          expiresAt: Date.now() + (ttlSeconds * 1000)
        })
      );

      logger.debug('Password reset token created', { userId, token: token.substring(0, 8) + '...' });

    } catch (error) {
      logger.error('Failed to set password reset token', { error: (error as Error).message, userId });
    }
  }

  async getPasswordResetToken(token: string): Promise<{ userId: string } | null> {
    try {
      const data = await this.client.get(`${this.prefixes.PASSWORD_RESET}${token}`);
      if (!data) return null;

      const tokenData = JSON.parse(data);
      
      // Check if token is expired
      if (tokenData.expiresAt < Date.now()) {
        await this.client.del(`${this.prefixes.PASSWORD_RESET}${token}`);
        return null;
      }

      return { userId: tokenData.userId };

    } catch (error) {
      logger.error('Failed to get password reset token', { error: (error as Error).message });
      return null;
    }
  }

  async invalidatePasswordResetToken(token: string): Promise<void> {
    try {
      await this.client.del(`${this.prefixes.PASSWORD_RESET}${token}`);
      logger.debug('Password reset token invalidated');
    } catch (error) {
      logger.error('Failed to invalidate password reset token', { error: (error as Error).message });
    }
  }

  /**
   * Analytics caching
   */
  async cacheAnalytics(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    try {
      await this.client.setex(
        `${this.prefixes.ANALYTICS_CACHE}${key}`,
        ttlSeconds,
        JSON.stringify({
          data,
          cachedAt: Date.now(),
          expiresAt: Date.now() + (ttlSeconds * 1000)
        })
      );
    } catch (error) {
      logger.error('Failed to cache analytics', { error: (error as Error).message, key });
    }
  }

  async getCachedAnalytics(key: string): Promise<any | null> {
    try {
      const cached = await this.client.get(`${this.prefixes.ANALYTICS_CACHE}${key}`);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check if cache is expired
      if (cacheData.expiresAt < Date.now()) {
        await this.client.del(`${this.prefixes.ANALYTICS_CACHE}${key}`);
        return null;
      }

      return cacheData.data;

    } catch (error) {
      logger.error('Failed to get cached analytics', { error: (error as Error).message, key });
      return null;
    }
  }

  /**
   * Real-time messaging
   */
  async publishRealtimeUpdate(channel: string, data: any): Promise<void> {
    try {
      await this.publisher.publish(channel, JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
    } catch (error) {
      logger.error('Failed to publish real-time update', { error: (error as Error).message, channel });
    }
  }

  private handleRealtimeMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);
      
      // Handle different types of real-time messages
      switch (channel) {
        case 'conversation:updates':
          this.handleConversationUpdate(data);
          break;
        case 'user:notifications':
          this.handleUserNotification(data);
          break;
        case 'system:alerts':
          this.handleSystemAlert(data);
          break;
        case 'analytics:realtime':
          this.handleAnalyticsUpdate(data);
          break;
      }

    } catch (error) {
      logger.error('Failed to handle real-time message', { error: (error as Error).message, channel });
    }
  }

  private handleConversationUpdate(data: any): void {
    logger.debug('Conversation update received', { conversationId: data.conversationId });
    // WebSocket broadcasting would be implemented here
  }

  private handleUserNotification(data: any): void {
    logger.debug('User notification received', { userId: data.userId });
    // Push notification logic would be implemented here
  }

  private handleSystemAlert(data: any): void {
    logger.info('System alert received', { type: data.type, severity: data.severity });
    // System alert handling would be implemented here
  }

  private handleAnalyticsUpdate(data: any): void {
    logger.debug('Analytics update received', { type: data.type });
    // Real-time analytics updates would be implemented here
  }

  /**
   * GDPR data cleanup
   */
  async cleanupExpiredData(): Promise<{ deletedKeys: number }> {
    try {
      let deletedKeys = 0;
      const patterns = [
        `${this.prefixes.USER_CACHE}*`,
        `${this.prefixes.USER_SESSION}*`,
        `${this.prefixes.PASSWORD_RESET}*`,
        `${this.prefixes.EMAIL_VERIFICATION}*`,
        `${this.prefixes.ANALYTICS_CACHE}*`
      ];

      for (const pattern of patterns) {
        const keys = await this.client.keys(pattern);
        
        for (const key of keys) {
          const ttl = await this.client.ttl(key);
          if (ttl === -1) { // No expiration set, check manually
            const data = await this.client.get(key);
            if (data) {
              try {
                const parsed = JSON.parse(data);
                if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
                  await this.client.del(key);
                  deletedKeys++;
                }
              } catch {
                // If we can't parse, let Redis TTL handle it
              }
            }
          }
        }
      }

      logger.info('Redis data cleanup completed', { deletedKeys });
      return { deletedKeys };

    } catch (error) {
      logger.error('Failed to cleanup Redis data', { error: (error as Error).message });
      return { deletedKeys: 0 };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; memory: string; connections: number }> {
    try {
      const info = await this.client.info('memory');
      const connections = await this.client.info('clients');
      
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const connectionsMatch = connections.match(/connected_clients:(\d+)/);
      
      return {
        status: 'healthy',
        memory: memoryMatch ? memoryMatch[1].trim() : 'unknown',
        connections: connectionsMatch ? parseInt(connectionsMatch[1]) : 0
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        memory: 'unknown',
        connections: 0
      };
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await Promise.all([
      this.client.disconnect(),
      this.subscriber.disconnect(),
      this.publisher.disconnect()
    ]);
    
    this.isConnected = false;
    logger.info('Redis connections closed');
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
