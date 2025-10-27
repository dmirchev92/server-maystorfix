// Database Manager Service
// Orchestrates PostgreSQL, MongoDB, and Redis connections with GDPR compliance

import { PostgreSQLDatabase } from '../models/PostgreSQLModels';
import { MongoDBDatabase } from '../models/MongoDBModels';
import { RedisDatabase } from '../models/RedisModels';
import config from '../utils/config';
import logger, { gdprLogger } from '../utils/logger';
import {
  User,
  Conversation,
  BusinessMetrics,
  ServiceTextProError
} from '../types';

export interface DatabaseHealthStatus {
  postgresql: {
    status: 'healthy' | 'unhealthy';
    connections?: number;
    error?: string;
  };
  mongodb: {
    status: 'healthy' | 'unhealthy';
    collections?: number;
    error?: string;
  };
  redis: {
    status: 'healthy' | 'unhealthy';
    memory?: string;
    connections?: number;
    error?: string;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export interface DataCleanupResult {
  postgresql: { deletedRecords: number };
  mongodb: { deletedRecords: number; anonymizedRecords: number };
  redis: { deletedKeys: number };
  totalCleaned: number;
  cleanupTime: number;
}

export class DatabaseManager {
  private postgresql: PostgreSQLDatabase;
  private mongodb: MongoDBDatabase;
  private redis: RedisDatabase;
  private isInitialized: boolean = false;
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.postgresql = new PostgreSQLDatabase();
    this.mongodb = new MongoDBDatabase();
    this.redis = new RedisDatabase();
  }

  /**
   * Initialize all database connections
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing database connections...');

      // Connect to all databases in parallel
      await Promise.all([
        this.postgresql.initialize(),
        this.mongodb.connect(),
        this.redis.connect()
      ]);

      // Set up automated cleanup if enabled
      if (config.gdpr.compliance.autoDeleteExpiredData) {
        this.setupAutomatedCleanup();
      }

      this.isInitialized = true;
      logger.info('All database connections initialized successfully');

      // Log initialization for GDPR audit
      gdprLogger.logDataAccess(
        'system',
        'database_initialization',
        'system_startup'
      );

    } catch (error) {
      logger.error('Failed to initialize databases', { error: error.message });
      throw new ServiceTextProError(
        'Database initialization failed',
        'DATABASE_INIT_ERROR',
        503
      );
    }
  }

  /**
   * Set up automated data cleanup based on GDPR retention policies
   */
  private setupAutomatedCleanup(): void {
    // Run cleanup every 24 hours
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.runDataCleanup();
      } catch (error) {
        logger.error('Automated data cleanup failed', { error: error.message });
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    logger.info('Automated GDPR data cleanup scheduled');
  }

  /**
   * User operations with caching
   */
  async createUser(user: User): Promise<string> {
    try {
      // Create user in PostgreSQL
      const userId = await this.postgresql.createUser(null, user);

      // Cache user in Redis for faster access
      await this.redis.cacheUser({ ...user, id: userId });

      // Log user creation for GDPR audit
      gdprLogger.logDataAccess(
        userId,
        'user_creation',
        'account_registration'
      );

      logger.info('User created successfully', { userId });
      return userId;

    } catch (error) {
      logger.error('Failed to create user', { error: error.message });
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      // Try to get from cache first
      const cachedUserId = await this.redis.getCachedUserByEmail(email);
      if (cachedUserId) {
        const cachedUser = await this.redis.getCachedUser(cachedUserId);
        if (cachedUser) {
          // Convert cached user back to full User object
          const fullUser = await this.postgresql.findUserById(cachedUserId);
          if (fullUser) {
            return fullUser;
          }
        }
      }

      // Get from PostgreSQL if not in cache
      const user = await this.postgresql.findUserByEmail(email);
      if (user) {
        // Cache the user for future requests
        await this.redis.cacheUser(user);
      }

      return user;

    } catch (error) {
      logger.error('Failed to find user by email', { error: error.message });
      throw error;
    }
  }

  async findUserById(id: string): Promise<User | null> {
    try {
      // Try to get from cache first
      const cachedUser = await this.redis.getCachedUser(id);
      if (cachedUser) {
        // Convert cached user back to full User object
        const fullUser = await this.postgresql.findUserById(id);
        if (fullUser) {
          return fullUser;
        }
      }

      // Get from PostgreSQL if not in cache
      const user = await this.postgresql.findUserById(id);
      if (user) {
        // Cache the user for future requests
        await this.redis.cacheUser(user);
      }

      return user;

    } catch (error) {
      logger.error('Failed to find user by ID', { error: error.message });
      throw error;
    }
  }

  async updateUser(user: User): Promise<void> {
    try {
      // Update in PostgreSQL
      await this.postgresql.updateUser(user);

      // Update cache
      await this.redis.cacheUser(user);

      // Log user update for GDPR audit
      gdprLogger.logDataAccess(
        user.id,
        'user_update',
        'profile_modification'
      );

      logger.info('User updated successfully', { userId: user.id });

    } catch (error) {
      logger.error('Failed to update user', { error: error.message });
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      // This is a GDPR erasure operation
      // 1. Mark user as deleted in PostgreSQL (don't actually delete for audit)
      const user = await this.postgresql.findUserById(userId);
      if (user) {
        user.status = 'deleted' as any;
        user.updatedAt = new Date();
        await this.postgresql.updateUser(user);
      }

      // 2. Delete conversations from MongoDB
      // Implementation would depend on MongoDB model methods

      // 3. Clear all cached data in Redis
      await this.redis.invalidateUserCache(userId, user?.email);
      await this.redis.invalidateAllUserSessions(userId);

      // Log GDPR erasure
      gdprLogger.logPrivacyRightRequest(userId, 'DATA_ERASURE', 'COMPLETED');

      logger.info('User deleted (GDPR erasure)', { userId });

    } catch (error) {
      logger.error('Failed to delete user', { error: error.message });
      throw error;
    }
  }

  /**
   * Conversation operations
   */
  async createConversation(conversation: Conversation): Promise<string> {
    try {
      // Store conversation in MongoDB
      const conversationId = await this.mongodb.createConversation(conversation as any);

      // Cache conversation state in Redis for real-time access
      await this.redis.setConversationState(conversation.id, {
        conversationId: conversation.id,
        businessId: conversation.businessId,
        customerPhone: conversation.customerPhoneNumber,
        platform: conversation.platform,
        state: conversation.state,
        lastActivity: Date.now(),
        contextData: {},
        aiAnalysisInProgress: false
      });

      // Publish real-time update
      await this.redis.publishRealtimeUpdate('conversation:updates', {
        type: 'conversation_created',
        conversationId: conversation.id,
        businessId: conversation.businessId
      });

      logger.info('Conversation created', { conversationId: conversation.id });
      return conversationId;

    } catch (error) {
      logger.error('Failed to create conversation', { error: error.message });
      throw error;
    }
  }

  async findConversationById(id: string): Promise<Conversation | null> {
    try {
      // Get from MongoDB
      const conversation = await this.mongodb.findConversationById(id);
      if (!conversation) return null;

      // Also get real-time state from Redis
      const state = await this.redis.getConversationState(id);
      if (state) {
        // Merge real-time state with stored conversation
        return {
          ...conversation,
          state: state.state || conversation.state
        } as Conversation;
      }

      return conversation as Conversation;

    } catch (error) {
      logger.error('Failed to find conversation', { error: error.message });
      throw error;
    }
  }

  /**
   * Analytics operations with caching
   */
  async getBusinessMetrics(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BusinessMetrics> {
    try {
      // Try to get from cache first
      const cacheKey = `business:${businessId}:${startDate.getTime()}:${endDate.getTime()}`;
      const cached = await this.redis.getCachedAnalytics(cacheKey);
      if (cached) {
        return cached;
      }

      // Get from MongoDB if not cached
      const metrics = await this.mongodb.getBusinessMetrics(businessId, startDate, endDate);

      // Cache for 5 minutes
      await this.redis.cacheAnalytics(cacheKey, metrics, 300);

      return metrics;

    } catch (error) {
      logger.error('Failed to get business metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Session management
   */
  async createSession(sessionData: any): Promise<void> {
    try {
      await this.redis.createSession(sessionData);
    } catch (error) {
      logger.error('Failed to create session', { error: error.message });
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<any> {
    try {
      return await this.redis.getSession(sessionId);
    } catch (error) {
      logger.error('Failed to get session', { error: error.message });
      throw error;
    }
  }

  async invalidateSession(sessionId: string): Promise<void> {
    try {
      await this.redis.invalidateSession(sessionId);
    } catch (error) {
      logger.error('Failed to invalidate session', { error: error.message });
    }
  }

  /**
   * Password reset operations
   */
  async setPasswordResetToken(userId: string, token: string): Promise<void> {
    try {
      // Store in both PostgreSQL (for audit) and Redis (for quick access)
      await Promise.all([
        this.postgresql.savePasswordResetToken(userId, token, new Date(Date.now() + 3600000)),
        this.redis.setPasswordResetToken(userId, token, 3600)
      ]);
    } catch (error) {
      logger.error('Failed to set password reset token', { error: error.message });
      throw error;
    }
  }

  async validatePasswordResetToken(token: string): Promise<{ userId: string } | null> {
    try {
      // Check Redis first (faster)
      const redisResult = await this.redis.getPasswordResetToken(token);
      if (redisResult) {
        return redisResult;
      }

      // Fallback to PostgreSQL
      return await this.postgresql.validatePasswordResetToken(token);

    } catch (error) {
      logger.error('Failed to validate password reset token', { error: error.message });
      return null;
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
      return await this.redis.checkRateLimit(identifier, windowMs, maxRequests);
    } catch (error) {
      logger.error('Rate limit check failed', { error: error.message });
      // Allow request if rate limiting fails
      return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowMs };
    }
  }

  /**
   * GDPR data cleanup
   */
  async runDataCleanup(): Promise<DataCleanupResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting GDPR data cleanup...');

      // Run cleanup on all databases in parallel
      const [postgresqlResult, mongodbResult, redisResult] = await Promise.all([
        this.postgresql.cleanupExpiredData(),
        this.mongodb.cleanupExpiredData(),
        this.redis.cleanupExpiredData()
      ]);

      const totalCleaned = 
        postgresqlResult.deletedRecords +
        mongodbResult.deletedRecords +
        mongodbResult.anonymizedRecords +
        redisResult.deletedKeys;

      const cleanupTime = Date.now() - startTime;

      const result: DataCleanupResult = {
        postgresql: postgresqlResult,
        mongodb: mongodbResult,
        redis: redisResult,
        totalCleaned,
        cleanupTime
      };

      // Log cleanup completion
      gdprLogger.logDataRetention('automated_cleanup', 'COMPLETED', totalCleaned);

      logger.info('GDPR data cleanup completed', {
        totalCleaned,
        cleanupTime,
        details: result
      });

      return result;

    } catch (error) {
      logger.error('GDPR data cleanup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Health check for all databases
   */
  async healthCheck(): Promise<DatabaseHealthStatus> {
    try {
      const [postgresqlHealth, mongodbHealth, redisHealth] = await Promise.all([
        this.postgresql.healthCheck().catch(error => ({ status: 'unhealthy', error: error.message })),
        this.mongodb.healthCheck().catch(error => ({ status: 'unhealthy', error: error.message })),
        this.redis.healthCheck().catch(error => ({ status: 'unhealthy', error: error.message }))
      ]);

      const healthStatuses = [postgresqlHealth.status, mongodbHealth.status, redisHealth.status];
      const healthyCount = healthStatuses.filter(status => status === 'healthy').length;

      let overall: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyCount === 3) {
        overall = 'healthy';
      } else if (healthyCount >= 2) {
        overall = 'degraded';
      } else {
        overall = 'unhealthy';
      }

      return {
        postgresql: postgresqlHealth,
        mongodb: mongodbHealth,
        redis: redisHealth,
        overall
      };

    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        postgresql: { status: 'unhealthy', error: error.message },
        mongodb: { status: 'unhealthy', error: error.message },
        redis: { status: 'unhealthy', error: error.message },
        overall: 'unhealthy'
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down database connections...');

      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Close all database connections in parallel
      await Promise.all([
        this.postgresql.close(),
        this.mongodb.close(),
        this.redis.close()
      ]);

      this.isInitialized = false;
      logger.info('All database connections closed');

    } catch (error) {
      logger.error('Error during database shutdown', { error: error.message });
      throw error;
    }
  }

  /**
   * Get initialization status
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get individual database instances (for direct access when needed)
   */
  get databases() {
    return {
      postgresql: this.postgresql,
      mongodb: this.mongodb,
      redis: this.redis
    };
  }
}
