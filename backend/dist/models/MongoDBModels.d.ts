import { ObjectId } from 'mongodb';
import { ConversationState, MessagePlatform, MessageStatus, AIAnalysisResult, BusinessMetrics, GDPRConsent } from '../types';
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
export declare class MongoDBDatabase {
    private client;
    private db;
    private isConnected;
    private conversations;
    private analyticsEvents;
    private messageTemplates;
    private systemLogs;
    constructor();
    connect(): Promise<void>;
    private createIndexes;
    private seedInitialData;
    createConversation(conversation: Omit<MongoConversation, '_id'>): Promise<string>;
    findConversationById(id: string): Promise<MongoConversation | null>;
    findConversationsByBusiness(businessId: string, limit?: number, offset?: number): Promise<MongoConversation[]>;
    updateConversation(id: string, update: Partial<MongoConversation>): Promise<void>;
    addMessageToConversation(conversationId: string, message: MongoMessage): Promise<void>;
    createAnalyticsEvent(event: Omit<MongoAnalyticsEvent, '_id'>): Promise<void>;
    getBusinessMetrics(businessId: string, startDate: Date, endDate: Date): Promise<BusinessMetrics>;
    findMessageTemplates(businessId: string, category?: string, language?: 'bg' | 'en'): Promise<MongoMessageTemplate[]>;
    updateTemplateUsage(templateId: string): Promise<void>;
    cleanupExpiredData(): Promise<{
        deletedRecords: number;
        anonymizedRecords: number;
    }>;
    searchConversations(businessId: string, query: {
        customerPhone?: string;
        dateRange?: {
            start: Date;
            end: Date;
        };
        platform?: MessagePlatform;
        state?: ConversationState;
        priority?: string;
    }, limit?: number, offset?: number): Promise<{
        conversations: MongoConversation[];
        total: number;
    }>;
    private getEventCount;
    private calculateConversionRate;
    private calculateAverageResponseTime;
    private calculatePlatformBreakdown;
    healthCheck(): Promise<{
        status: string;
        collections: number;
    }>;
    close(): Promise<void>;
    get connected(): boolean;
}
//# sourceMappingURL=MongoDBModels.d.ts.map