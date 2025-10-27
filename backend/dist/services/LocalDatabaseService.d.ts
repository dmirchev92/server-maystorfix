import { LocalDatabase } from '../models/LocalModels';
import { User, Conversation, BusinessMetrics } from '../types';
export interface LocalHealthStatus {
    postgresql: {
        status: 'healthy' | 'unhealthy';
        tables?: number;
        error?: string;
    };
    overall: 'healthy' | 'unhealthy';
}
export declare class LocalDatabaseService {
    private database;
    private isInitialized;
    constructor();
    initialize(): Promise<void>;
    createUser(user: User): Promise<string>;
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    createConversation(conversation: Conversation): Promise<string>;
    getBusinessMetrics(businessId: string, startDate: Date, endDate: Date): Promise<BusinessMetrics>;
    createSession(sessionData: any): Promise<void>;
    checkRateLimit(identifier: string, windowMs: number, maxRequests: number): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime: number;
    }>;
    healthCheck(): Promise<LocalHealthStatus>;
    shutdown(): Promise<void>;
    get initialized(): boolean;
    get db(): LocalDatabase;
}
//# sourceMappingURL=LocalDatabaseService.d.ts.map