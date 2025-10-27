import sqlite3 from 'sqlite3';
import { User } from '../types';
export declare class SQLiteDatabase {
    private _db;
    private isConnected;
    get db(): sqlite3.Database;
    constructor();
    private initializeTables;
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    createUser(user: User): Promise<string>;
    updateUser(user: User): Promise<void>;
    private getGDPRConsentsForUser;
    private mapUserFromDatabase;
    private generateId;
    private ensureUserPublicIdColumn;
    private generatePublicIdCandidate;
    private isPublicIdUnique;
    private generateUniquePublicId;
    ensureUserPublicId(userId: string): Promise<string>;
    getUserIdByPublicId(publicId: string): Promise<string | null>;
    createOrUpdateProviderProfile(userId: string, profileData: any): Promise<void>;
    replaceProviderGallery(userId: string, imageUrls: string[]): Promise<void>;
    replaceProviderCertificates(userId: string, certificates: Array<{
        title?: string;
        fileUrl?: string;
        issuedBy?: string;
        issuedAt?: string;
    }>): Promise<void>;
    getProviderGallery(userId: string): Promise<string[]>;
    getProviderCertificates(userId: string): Promise<any[]>;
    searchProviders(filters: any): Promise<any[]>;
    getProviderProfile(providerId: string): Promise<any | null>;
    getServiceCategories(): Promise<any[]>;
    createMarketplaceInquiry(inquiryData: any): Promise<string>;
    getProviderInquiries(providerId: string): Promise<any[]>;
    addProviderReview(reviewData: any): Promise<void>;
    private updateProviderRating;
    getCitiesWithProviders(): Promise<string[]>;
    getNeighborhoodsInCity(city: string): Promise<string[]>;
    createOrGetConversation(data: {
        providerId: string;
        customerId?: string;
        customerName: string;
        customerEmail: string;
        customerPhone?: string;
    }): Promise<string>;
    private continueConversationCreation;
    private autoSendServiceRequestButton;
    sendMessage(data: {
        conversationId: string;
        senderType: 'customer' | 'provider';
        senderName: string;
        message: string;
        messageType?: string;
    }): Promise<string>;
    getConversationMessages(conversationId: string, limit?: number): Promise<any[]>;
    getProviderConversations(providerId: string): Promise<any[]>;
    getAllUserConversations(userId: string): Promise<any[]>;
    getUnifiedConversationMessages(conversationId: string, conversationType: 'phone' | 'marketplace'): Promise<any[]>;
    getConversationDetails(conversationId: string): Promise<any>;
    createCaseTemplate(data: {
        serviceCategory: string;
        templateName: string;
        templateData: any;
    }): Promise<string>;
    getCaseTemplate(serviceCategory: string): Promise<any>;
    createServiceCase(data: {
        conversationId: string;
        templateId: string;
        customerId: string;
        providerId?: string;
        caseData: any;
        priority?: string;
    }): Promise<string>;
    updateServiceCase(caseId: string, updates: {
        status?: string;
        caseData?: any;
        providerId?: string;
        estimatedCost?: number;
        estimatedDuration?: number;
        scheduledDate?: string;
        assignedAt?: string;
    }): Promise<void>;
    getServiceCaseByConversation(conversationId: string): Promise<any>;
    addCaseToQueue(caseId: string, originalProviderId: string): Promise<string>;
    getAvailableCasesFromQueue(providerId: string, limit?: number): Promise<any[]>;
    markMessagesAsRead(conversationId: string, senderType: 'customer' | 'provider'): Promise<void>;
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
    close(): void;
}
//# sourceMappingURL=SQLiteDatabase.d.ts.map