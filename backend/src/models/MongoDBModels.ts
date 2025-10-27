// MongoDB Database Models
// Unstructured data: conversations, analytics, logs, message templates

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import config from '../utils/config';
import logger, { gdprLogger } from '../utils/logger';
import {
  Conversation,
  ConversationState,
  Message,
  MessagePlatform,
  MessageStatus,
  AIAnalysisResult,
  ProblemType,
  UrgencyLevel,
  BusinessMetrics,
  SystemMetrics,
  GDPRConsent
} from '../types';

export interface MongoConversation {
  _id?: ObjectId;
  id: string;
  businessId: string;
  customerPhoneNumber: string;
  customerName?: string;
  platform: MessagePlatform;
  state: ConversationState;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  startedAt: Date;
  lastMessageAt: Date;
  closedAt?: Date;
  messages: MongoMessage[];
  aiAnalysis?: AIAnalysisResult;
  gdprRetentionUntil: Date;
  customerConsent?: GDPRConsent;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoMessage {
  id: string;
  conversationId: string;
  platform: MessagePlatform;
  direction: 'inbound' | 'outbound';
  content: string;
  status: MessageStatus;
  timestamp: Date;
  deliveredAt?: Date;
  readAt?: Date;
  metadata?: Record<string, any>;
  gdprRetentionUntil: Date;
}

export interface MongoAnalyticsEvent {
  _id?: ObjectId;
  id: string;
  eventType: string;
  userId?: string;
  businessId?: string;
  data: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  gdprRetentionUntil: Date;
  anonymized: boolean;
  createdAt: Date;
}

export interface MongoMessageTemplate {
  _id?: ObjectId;
  id: string;
  businessId: string;
  name: string;
  category: 'emergency' | 'business_hours' | 'after_hours' | 'new_customer' | 'follow_up';
  title: string;
  content: string;
  variables: string[];
  triggers: string[];
  conditions: Record<string, any>;
  isActive: boolean;
  language: 'bg' | 'en';
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  effectivenessScore?: number;
}

export class MongoDBDatabase {
  private client: MongoClient;
  private db: Db;
  private isConnected: boolean = false;

  // Collections
  private conversations: Collection<MongoConversation>;
  private analyticsEvents: Collection<MongoAnalyticsEvent>;
  private messageTemplates: Collection<MongoMessageTemplate>;
  private systemLogs: Collection<any>;

  constructor() {
    this.client = new MongoClient(config.database.mongodb.uri, {
      maxPoolSize: config.database.mongodb.maxPoolSize,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  }

  /**
   * Connect to MongoDB and initialize collections
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(config.database.mongodb.database);
      
      // Initialize collections
      this.conversations = this.db.collection<MongoConversation>('conversations');
      this.analyticsEvents = this.db.collection<MongoAnalyticsEvent>('analytics_events');
      this.messageTemplates = this.db.collection<MongoMessageTemplate>('message_templates');
      this.systemLogs = this.db.collection('system_logs');

      await this.createIndexes();
      await this.seedInitialData();

      this.isConnected = true;
      logger.info('MongoDB connected successfully');

      // Set up event handlers
      this.client.on('serverHeartbeatSucceeded', () => {
        this.isConnected = true;
      });

      this.client.on('serverHeartbeatFailed', () => {
        this.isConnected = false;
        logger.error('MongoDB heartbeat failed');
      });

    } catch (error) {
      logger.error('Failed to connect to MongoDB', { error: error.message });
      throw error;
    }
  }

  /**
   * Create indexes for performance
   */
  private async createIndexes(): Promise<void> {
    try {
      // Conversations indexes
      await this.conversations.createIndexes([
        { key: { businessId: 1 } },
        { key: { customerPhoneNumber: 1 } },
        { key: { state: 1 } },
        { key: { priority: 1 } },
        { key: { startedAt: -1 } },
        { key: { lastMessageAt: -1 } },
        { key: { gdprRetentionUntil: 1 } },
        { key: { platform: 1 } },
        { key: { businessId: 1, state: 1 } },
        { key: { businessId: 1, startedAt: -1 } }
      ]);

      // Analytics events indexes
      await this.analyticsEvents.createIndexes([
        { key: { eventType: 1 } },
        { key: { userId: 1 } },
        { key: { businessId: 1 } },
        { key: { timestamp: -1 } },
        { key: { gdprRetentionUntil: 1 } },
        { key: { anonymized: 1 } },
        { key: { businessId: 1, eventType: 1 } },
        { key: { businessId: 1, timestamp: -1 } }
      ]);

      // Message templates indexes
      await this.messageTemplates.createIndexes([
        { key: { businessId: 1 } },
        { key: { category: 1 } },
        { key: { isActive: 1 } },
        { key: { language: 1 } },
        { key: { businessId: 1, category: 1 } },
        { key: { businessId: 1, isActive: 1 } }
      ]);

      // System logs indexes
      await this.systemLogs.createIndexes([
        { key: { level: 1 } },
        { key: { timestamp: -1 } },
        { key: { service: 1 } },
        { key: { gdprRelevant: 1 } }
      ]);

      logger.info('MongoDB indexes created successfully');

    } catch (error) {
      logger.error('Failed to create MongoDB indexes', { error: error.message });
      throw error;
    }
  }

  /**
   * Seed initial data
   */
  private async seedInitialData(): Promise<void> {
    try {
      // Check if we already have templates
      const templateCount = await this.messageTemplates.countDocuments();
      if (templateCount > 0) {
        logger.info('MongoDB already has data, skipping seed');
        return;
      }

      // Create default message templates
      const defaultTemplates: Omit<MongoMessageTemplate, '_id'>[] = [
        {
          id: 'default-emergency-bg',
          businessId: 'system',
          name: 'Спешен отговор',
          category: 'emergency',
          title: 'Спешна ситуация - незабавен отговор',
          content: 'Здравейте! Получих Вашето спешно съобщение. Ще се свържа с Вас в рамките на 15 минути. За критични аварии: {emergency_phone}',
          variables: ['emergency_phone', 'technician_name'],
          triggers: ['спешно', 'авария', 'парене', 'искри'],
          conditions: { priority: 'emergency' },
          isActive: true,
          language: 'bg',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        },
        {
          id: 'default-business-hours-bg',
          businessId: 'system',
          name: 'Работно време',
          category: 'business_hours',
          title: 'Отговор в работно време',
          content: 'Здравейте! Благодаря за съобщението. Ще прегледам заявката Ви и ще се върна при Вас до {response_time} минути.',
          variables: ['response_time', 'technician_name'],
          triggers: [],
          conditions: { business_hours: true },
          isActive: true,
          language: 'bg',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        },
        {
          id: 'default-after-hours-bg',
          businessId: 'system',
          name: 'Извън работно време',
          category: 'after_hours',
          title: 'Отговор извън работно време',
          content: 'Здравейте! Получих съобщението Ви извън работното ми време. Ще се свържа с Вас утре сутрин след {start_time}ч. За спешни случаи: {emergency_contact}',
          variables: ['start_time', 'emergency_contact'],
          triggers: [],
          conditions: { business_hours: false },
          isActive: true,
          language: 'bg',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        }
      ];

      await this.messageTemplates.insertMany(defaultTemplates);
      logger.info('Default message templates created');

    } catch (error) {
      logger.error('Failed to seed MongoDB initial data', { error: error.message });
      throw error;
    }
  }

  /**
   * Conversation operations
   */
  async createConversation(conversation: Omit<MongoConversation, '_id'>): Promise<string> {
    try {
      const result = await this.conversations.insertOne({
        ...conversation,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Log conversation creation for GDPR audit
      gdprLogger.logDataAccess(
        conversation.businessId,
        'conversation_creation',
        'customer_communication'
      );

      logger.info('Conversation created', { 
        conversationId: conversation.id,
        businessId: conversation.businessId,
        platform: conversation.platform
      });

      return result.insertedId.toString();

    } catch (error) {
      logger.error('Failed to create conversation', { error: error.message });
      throw error;
    }
  }

  async findConversationById(id: string): Promise<MongoConversation | null> {
    try {
      return await this.conversations.findOne({ id });
    } catch (error) {
      logger.error('Failed to find conversation', { error: error.message, conversationId: id });
      throw error;
    }
  }

  async findConversationsByBusiness(
    businessId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MongoConversation[]> {
    try {
      return await this.conversations
        .find({ businessId })
        .sort({ lastMessageAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Failed to find conversations by business', { 
        error: error.message, 
        businessId 
      });
      throw error;
    }
  }

  async updateConversation(id: string, update: Partial<MongoConversation>): Promise<void> {
    try {
      await this.conversations.updateOne(
        { id },
        { 
          $set: { 
            ...update, 
            updatedAt: new Date() 
          } 
        }
      );

      logger.info('Conversation updated', { conversationId: id });

    } catch (error) {
      logger.error('Failed to update conversation', { error: error.message, conversationId: id });
      throw error;
    }
  }

  async addMessageToConversation(conversationId: string, message: MongoMessage): Promise<void> {
    try {
      await this.conversations.updateOne(
        { id: conversationId },
        {
          $push: { messages: message },
          $set: { 
            lastMessageAt: message.timestamp,
            updatedAt: new Date()
          }
        }
      );

      logger.info('Message added to conversation', { 
        conversationId, 
        messageId: message.id,
        direction: message.direction
      });

    } catch (error) {
      logger.error('Failed to add message to conversation', { 
        error: error.message, 
        conversationId, 
        messageId: message.id 
      });
      throw error;
    }
  }

  /**
   * Analytics operations
   */
  async createAnalyticsEvent(event: Omit<MongoAnalyticsEvent, '_id'>): Promise<void> {
    try {
      await this.analyticsEvents.insertOne({
        ...event,
        createdAt: new Date()
      });

      // Don't log analytics events to avoid recursive logging
    } catch (error) {
      logger.error('Failed to create analytics event', { error: error.message });
      throw error;
    }
  }

  async getBusinessMetrics(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BusinessMetrics> {
    try {
      const pipeline = [
        {
          $match: {
            businessId,
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
            data: { $push: '$data' }
          }
        }
      ];

      const results = await this.analyticsEvents.aggregate(pipeline).toArray();

      // Process results into BusinessMetrics format
      const metrics: BusinessMetrics = {
        businessId,
        period: { start: startDate, end: endDate },
        missedCalls: this.getEventCount(results, 'missed_call'),
        responsesSent: this.getEventCount(results, 'response_sent'),
        conversationsStarted: this.getEventCount(results, 'conversation_started'),
        conversationsCompleted: this.getEventCount(results, 'conversation_completed'),
        conversionRate: this.calculateConversionRate(results),
        averageResponseTime: this.calculateAverageResponseTime(results),
        platformBreakdown: this.calculatePlatformBreakdown(results),
      };

      return metrics;

    } catch (error) {
      logger.error('Failed to get business metrics', { error: error.message, businessId });
      throw error;
    }
  }

  /**
   * Message template operations
   */
  async findMessageTemplates(
    businessId: string,
    category?: string,
    language: 'bg' | 'en' = 'bg'
  ): Promise<MongoMessageTemplate[]> {
    try {
      const query: any = {
        $or: [
          { businessId },
          { businessId: 'system' }
        ],
        isActive: true,
        language
      };

      if (category) {
        query.category = category;
      }

      return await this.messageTemplates
        .find(query)
        .sort({ businessId: -1, usageCount: -1 })
        .toArray();

    } catch (error) {
      logger.error('Failed to find message templates', { error: error.message });
      throw error;
    }
  }

  async updateTemplateUsage(templateId: string): Promise<void> {
    try {
      await this.messageTemplates.updateOne(
        { id: templateId },
        { 
          $inc: { usageCount: 1 },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (error) {
      logger.error('Failed to update template usage', { error: error.message, templateId });
    }
  }

  /**
   * Data retention and cleanup
   */
  async cleanupExpiredData(): Promise<{ deletedRecords: number; anonymizedRecords: number }> {
    try {
      let deletedRecords = 0;
      let anonymizedRecords = 0;

      const now = new Date();

      // Delete expired conversations
      const conversationResult = await this.conversations.deleteMany({
        gdprRetentionUntil: { $lt: now }
      });
      deletedRecords += conversationResult.deletedCount || 0;

      // Anonymize expired analytics events
      const analyticsResult = await this.analyticsEvents.updateMany(
        {
          gdprRetentionUntil: { $lt: now },
          anonymized: false
        },
        {
          $set: {
            anonymized: true,
            userId: null,
            ipAddress: null,
            userAgent: null,
            'data.phoneNumber': null,
            'data.email': null,
            updatedAt: new Date()
          }
        }
      );
      anonymizedRecords += analyticsResult.modifiedCount || 0;

      // Log cleanup activity
      gdprLogger.logDataRetention('mongodb_cleanup', 'DELETED', deletedRecords);
      gdprLogger.logDataRetention('mongodb_anonymization', 'UPDATED', anonymizedRecords);

      logger.info('MongoDB data cleanup completed', { 
        deletedRecords, 
        anonymizedRecords 
      });

      return { deletedRecords, anonymizedRecords };

    } catch (error) {
      logger.error('Failed to cleanup MongoDB data', { error: error.message });
      throw error;
    }
  }

  /**
   * Search operations
   */
  async searchConversations(
    businessId: string,
    query: {
      customerPhone?: string;
      dateRange?: { start: Date; end: Date };
      platform?: MessagePlatform;
      state?: ConversationState;
      priority?: string;
    },
    limit: number = 50,
    offset: number = 0
  ): Promise<{ conversations: MongoConversation[]; total: number }> {
    try {
      const searchFilter: any = { businessId };

      if (query.customerPhone) {
        searchFilter.customerPhoneNumber = new RegExp(query.customerPhone, 'i');
      }

      if (query.dateRange) {
        searchFilter.startedAt = {
          $gte: query.dateRange.start,
          $lte: query.dateRange.end
        };
      }

      if (query.platform) {
        searchFilter.platform = query.platform;
      }

      if (query.state) {
        searchFilter.state = query.state;
      }

      if (query.priority) {
        searchFilter.priority = query.priority;
      }

      const [conversations, total] = await Promise.all([
        this.conversations
          .find(searchFilter)
          .sort({ lastMessageAt: -1 })
          .skip(offset)
          .limit(limit)
          .toArray(),
        this.conversations.countDocuments(searchFilter)
      ]);

      return { conversations, total };

    } catch (error) {
      logger.error('Failed to search conversations', { error: error.message });
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private getEventCount(results: any[], eventType: string): number {
    const event = results.find(r => r._id === eventType);
    return event ? event.count : 0;
  }

  private calculateConversionRate(results: any[]): number {
    const started = this.getEventCount(results, 'conversation_started');
    const completed = this.getEventCount(results, 'conversation_completed');
    return started > 0 ? (completed / started) * 100 : 0;
  }

  private calculateAverageResponseTime(results: any[]): number {
    const responseEvents = results.find(r => r._id === 'response_sent');
    if (!responseEvents || !responseEvents.data.length) return 0;

    const responseTimes = responseEvents.data
      .map((d: any) => d.responseTime)
      .filter((t: any) => typeof t === 'number');

    return responseTimes.length > 0 
      ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
      : 0;
  }

  private calculatePlatformBreakdown(results: any[]): Record<MessagePlatform, number> {
    const breakdown: Record<MessagePlatform, number> = {
      [MessagePlatform.WHATSAPP]: 0,
      [MessagePlatform.VIBER]: 0,
      [MessagePlatform.TELEGRAM]: 0,
      [MessagePlatform.SMS]: 0,
      [MessagePlatform.EMAIL]: 0
    };

    results.forEach(result => {
      result.data.forEach((d: any) => {
        if (d.platform && breakdown.hasOwnProperty(d.platform)) {
          breakdown[d.platform as MessagePlatform]++;
        }
      });
    });

    return breakdown;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; collections: number }> {
    try {
      const adminDb = this.db.admin();
      await adminDb.ping();
      
      const collections = await this.db.listCollections().toArray();
      
      return {
        status: 'healthy',
        collections: collections.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        collections: 0
      };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.client.close();
    this.isConnected = false;
    logger.info('MongoDB connection closed');
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
