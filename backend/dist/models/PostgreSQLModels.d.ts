import { PoolClient } from 'pg';
import { User, GDPRConsent, AuditLog } from '../types';
export declare class PostgreSQLDatabase {
    private pool;
    private isConnected;
    constructor();
    private setupEventHandlers;
    initialize(): Promise<void>;
    private createTables;
    private createIndexes;
    private seedInitialData;
    createUser(client: PoolClient | null, user: User): Promise<string>;
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    createGDPRConsent(client: PoolClient, consent: GDPRConsent): Promise<void>;
    createAuditLog(auditLog: AuditLog): Promise<void>;
    cleanupExpiredData(): Promise<{
        deletedRecords: number;
    }>;
    private mapUserFromDatabase;
    healthCheck(): Promise<{
        status: string;
        connections: number;
    }>;
    close(): Promise<void>;
}
//# sourceMappingURL=PostgreSQLModels.d.ts.map