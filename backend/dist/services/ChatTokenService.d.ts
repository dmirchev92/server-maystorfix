export interface ChatToken {
    id: string;
    token: string;
    userId: string;
    spIdentifier: string;
    isUsed: boolean;
    usedAt?: Date;
    createdAt: Date;
    expiresAt: Date;
    conversationId?: string;
}
export interface ServiceProviderIdentifier {
    id: string;
    userId: string;
    identifier: string;
    createdAt: Date;
}
export declare class ChatTokenService {
    private readonly database;
    private readonly expirationDays;
    private generateId;
    constructor();
    initializeForUser(userId: string): Promise<{
        spIdentifier: string;
        currentToken: string;
    }>;
    private getOrCreateServiceProviderIdentifier;
    private createServiceProviderIdentifier;
    private generateServiceProviderIdentifier;
    getCurrentUnusedToken(userId: string, spIdentifier: string): Promise<string | null>;
    generateNewToken(userId: string, spIdentifier: string): Promise<string>;
    private generateSecureToken;
    validateAndUseToken(spIdentifier: string, token: string): Promise<{
        isValid: boolean;
        userId?: string;
        conversationId?: string;
        sessionId?: string;
        error?: string;
    }>;
    validateSession(sessionId: string): Promise<{
        isValid: boolean;
        userId?: string;
        conversationId?: string;
        spIdentifier?: string;
        error?: string;
    }>;
    getChatUrlForUser(userId: string, baseUrl?: string): Promise<string>;
    getCurrentTokenForSMS(userId: string): Promise<string>;
    forceRegenerateToken(userId: string): Promise<{
        newToken: string;
        chatUrl: string;
    }>;
    cleanupExpiredTokens(): Promise<number>;
    getTokenStats(userId: string): Promise<{
        totalGenerated: number;
        currentUnused: number;
        totalUsed: number;
        totalExpired: number;
    }>;
}
//# sourceMappingURL=ChatTokenService.d.ts.map