import { PostgreSQLDatabase } from '../models/PostgreSQLModels';
import { MongoDBDatabase } from '../models/MongoDBModels';
import { RedisDatabase } from '../models/RedisModels';
import { User, Conversation, BusinessMetrics } from '../types';
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
    postgresql: {
        deletedRecords: number;
    };
    mongodb: {
        deletedRecords: number;
        anonymizedRecords: number;
    };
    redis: {
        deletedKeys: number;
    };
    totalCleaned: number;
    cleanupTime: number;
}
export declare class DatabaseManager {
    private postgresql;
    private mongodb;
    private redis;
    private isInitialized;
    private cleanupInterval?;
    constructor();
    initialize(): Promise<void>;
    private setupAutomatedCleanup;
    createUser(user: User): Promise<string>;
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    updateUser(user: User): Promise<void>;
    deleteUser(userId: string): Promise<void>;
    createConversation(conversation: Conversation): Promise<string>;
    findConversationById(id: string): Promise<Conversation | null>;
    getBusinessMetrics(businessId: string, startDate: Date, endDate: Date): Promise<BusinessMetrics>;
    createSession(sessionData: any): Promise<void>;
    getSession(sessionId: string): Promise<any>;
    invalidateSession(sessionId: string): Promise<void>;
    setPasswordResetToken(userId: string, token: string): Promise<void>;
    validatePasswordResetToken(token: string): Promise<{
        userId: string;
    } | null>;
    checkRateLimit(identifier: string, windowMs: number, maxRequests: number): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime: number;
    }>;
    runDataCleanup(): Promise<DataCleanupResult>;
    healthCheck(): Promise<DatabaseHealthStatus>;
    shutdown(): Promise<void>;
    get initialized(): boolean;
    get databases(): {
        postgresql: PostgreSQLDatabase;
        mongodb: MongoDBDatabase;
        redis: RedisDatabase;
    };
}
//# sourceMappingURL=DatabaseManager.d.ts.map