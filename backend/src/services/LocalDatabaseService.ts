// Simplified Local Database Service
// Single PostgreSQL database for all data - perfect for local development

import { LocalDatabase } from '../models/LocalModels';
import config from '../utils/config';
import logger, { gdprLogger } from '../utils/logger';
import {
  User,
  Conversation,
  BusinessMetrics,
  ServiceTextProError
} from '../types';

export interface LocalHealthStatus {
  postgresql: {
    status: 'healthy' | 'unhealthy';
    tables?: number;
    error?: string;
  };
  overall: 'healthy' | 'unhealthy';
}

export class LocalDatabaseService {
  private database: LocalDatabase;
  private isInitialized: boolean = false;

  constructor() {
    this.database = new LocalDatabase();
  }

  /**
   * Initialize the local database
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing local PostgreSQL database...');

      await this.database.initialize();

      this.isInitialized = true;
      logger.info('Local database initialized successfully');

      // Log initialization for GDPR audit
      gdprLogger.logDataAccess(
        'system',
        'database_initialization',
        'system_startup'
      );

    } catch (error) {
      logger.error('Failed to initialize local database', { error: error.message });
      throw new ServiceTextProError(
        'Local database initialization failed',
        'DATABASE_INIT_ERROR',
        503
      );
    }
  }

  /**
   * User operations
   */
  async createUser(user: User): Promise<string> {
    try {
      const userId = await this.database.createUser(user);

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
      return await this.database.findUserByEmail(email);
    } catch (error) {
      logger.error('Failed to find user by email', { error: error.message });
      throw error;
    }
  }

  async findUserById(id: string): Promise<User | null> {
    try {
      // For local development, we'll implement this method in LocalDatabase
      // For now, we can use findUserByEmail as a placeholder
      return null; // TODO: Implement in LocalDatabase
    } catch (error) {
      logger.error('Failed to find user by ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Conversation operations
   */
  async createConversation(conversation: Conversation): Promise<string> {
    try {
      const conversationId = await this.database.createConversation(conversation);

      logger.info('Conversation created', { conversationId: conversation.id });
      return conversationId;

    } catch (error) {
      logger.error('Failed to create conversation', { error: error.message });
      throw error;
    }
  }

  /**
   * Analytics operations
   */
  async getBusinessMetrics(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BusinessMetrics> {
    try {
      return await this.database.getBusinessMetrics(businessId, startDate, endDate);
    } catch (error) {
      logger.error('Failed to get business metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Session management (using PostgreSQL instead of Redis)
   */
  async createSession(sessionData: any): Promise<void> {
    try {
      await this.database.createSession(sessionData);
    } catch (error) {
      logger.error('Failed to create session', { error: error.message });
      throw error;
    }
  }

  /**
   * Simple rate limiting (using PostgreSQL instead of Redis)
   */
  async checkRateLimit(
    identifier: string,
    windowMs: number,
    maxRequests: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      // For local development, we'll be more permissive
      // In production, you'd implement proper rate limiting
      return { 
        allowed: true, 
        remaining: maxRequests, 
        resetTime: Date.now() + windowMs 
      };
    } catch (error) {
      logger.error('Rate limit check failed', { error: error.message });
      // Allow request if rate limiting fails
      return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowMs };
    }
  }

  /**
   * Health check for local database
   */
  async healthCheck(): Promise<LocalHealthStatus> {
    try {
      const dbHealth = await this.database.healthCheck();
      
      return {
        postgresql: {
          status: dbHealth.status as 'healthy' | 'unhealthy',
          tables: dbHealth.tables
        },
        overall: dbHealth.status as 'healthy' | 'unhealthy'
      };

    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        postgresql: { status: 'unhealthy', error: error.message },
        overall: 'unhealthy'
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down local database connection...');
      await this.database.close();
      this.isInitialized = false;
      logger.info('Local database connection closed');
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
   * Get database instance for direct access when needed
   */
  get db() {
    return this.database;
  }
}
