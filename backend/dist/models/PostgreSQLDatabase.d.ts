import { PoolClient } from 'pg';
import { User } from '../types';
export declare class PostgreSQLDatabase {
    private pool;
    private isConnected;
    constructor();
    query(text: string, params?: any[]): Promise<any[]>;
    getClient(): Promise<PoolClient>;
    private initializeTables;
    close(): Promise<void>;
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    createUser(user: User): Promise<string>;
    updateUser(user: User): Promise<void>;
    private getGDPRConsentsForUser;
    private mapUserFromDatabase;
    private generateId;
    private generatePublicIdCandidate;
    private isPublicIdUnique;
    private generateUniquePublicId;
    ensureUserPublicId(userId: string): Promise<string>;
    getUserIdByPublicId(publicId: string): Promise<string | null>;
    get db(): any;
    getAllUserConversations(userId: string): Promise<any[]>;
    createOrUpdateProviderProfile(userId: string, profileData: any): Promise<void>;
    replaceProviderGallery(userId: string, imageUrls: string[]): Promise<void>;
    replaceProviderCertificates(userId: string, certificates: Array<{
        title?: string;
        fileUrl?: string;
        issuedBy?: string;
        issuedAt?: string;
    }>): Promise<void>;
    getSMSSettings(userId: string): Promise<any>;
    updateSMSSettings(userId: string, updates: {
        isEnabled?: boolean;
        message?: string;
        lastSentTime?: number;
        sentCount?: number;
        sentCallIds?: string[];
        filterKnownContacts?: boolean;
    }): Promise<void>;
    clearSMSHistory(userId: string): Promise<void>;
    createOrGetConversation(data: {
        providerId: string;
        customerId?: string;
        customerName: string;
        customerEmail: string;
        customerPhone?: string;
    }): Promise<string>;
    getConversationMessages(conversationId: string, limit?: number): Promise<any[]>;
    getProviderConversations(providerId: string): Promise<any[]>;
    getConversationDetails(conversationId: string): Promise<any>;
    sendMessage(data: {
        conversationId: string;
        senderType: 'customer' | 'provider';
        senderName: string;
        message: string;
        messageType?: string;
    }): Promise<string>;
    markMessagesAsRead(conversationId: string, senderType: 'customer' | 'provider'): Promise<void>;
}
export default PostgreSQLDatabase;
//# sourceMappingURL=PostgreSQLDatabase.d.ts.map