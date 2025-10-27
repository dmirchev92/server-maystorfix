import { User, Conversation, BusinessMetrics } from '../types';
export declare class LocalDatabase {
    private pool;
    private isConnected;
    constructor();
    private setupEventHandlers;
    initialize(): Promise<void>;
    private createAllTables;
    private createIndexes;
    private seedInitialData;
    createUser(user: User): Promise<string>;
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    updateUser(user: User): Promise<void>;
    createConversation(conversation: Conversation): Promise<string>;
    getBusinessMetrics(businessId: string, startDate: Date, endDate: Date): Promise<BusinessMetrics>;
    createSession(sessionData: any): Promise<void>;
    private mapUserFromDatabase;
    healthCheck(): Promise<{
        status: string;
        tables: number;
    }>;
    close(): Promise<void>;
}
//# sourceMappingURL=LocalModels.d.ts.map