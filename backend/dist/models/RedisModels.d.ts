import { User, MessagePlatform } from '../types';
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
export declare class RedisDatabase {
    private client;
    private subscriber;
    private publisher;
    private isConnected;
    private readonly prefixes;
    constructor();
    private setupEventHandlers;
    connect(): Promise<void>;
    cacheUser(user: User, ttlSeconds?: number): Promise<void>;
    getCachedUser(userId: string): Promise<CachedUser | null>;
    getCachedUserByEmail(email: string): Promise<string | null>;
    invalidateUserCache(userId: string, email?: string): Promise<void>;
    createSession(session: UserSession): Promise<void>;
    getSession(sessionId: string): Promise<UserSession | null>;
    invalidateSession(sessionId: string): Promise<void>;
    invalidateAllUserSessions(userId: string): Promise<void>;
    checkRateLimit(identifier: string, windowMs: number, maxRequests: number): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime: number;
    }>;
    setConversationState(conversationId: string, state: any, ttlSeconds?: number): Promise<void>;
    getConversationState(conversationId: string): Promise<any | null>;
    setPasswordResetToken(userId: string, token: string, ttlSeconds?: number): Promise<void>;
    getPasswordResetToken(token: string): Promise<{
        userId: string;
    } | null>;
    invalidatePasswordResetToken(token: string): Promise<void>;
    cacheAnalytics(key: string, data: any, ttlSeconds?: number): Promise<void>;
    getCachedAnalytics(key: string): Promise<any | null>;
    publishRealtimeUpdate(channel: string, data: any): Promise<void>;
    private handleRealtimeMessage;
    private handleConversationUpdate;
    private handleUserNotification;
    private handleSystemAlert;
    private handleAnalyticsUpdate;
    cleanupExpiredData(): Promise<{
        deletedKeys: number;
    }>;
    healthCheck(): Promise<{
        status: string;
        memory: string;
        connections: number;
    }>;
    close(): Promise<void>;
    get connected(): boolean;
}
//# sourceMappingURL=RedisModels.d.ts.map