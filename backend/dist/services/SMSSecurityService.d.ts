export interface SMSSecurityCheck {
    isAllowed: boolean;
    reason?: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    blockedReason?: string;
}
export interface SMSDestinationAnalysis {
    phoneNumber: string;
    isPremium: boolean;
    isInternational: boolean;
    countryCode?: string;
    carrier?: string;
    riskScore: number;
    flags: string[];
}
export declare class SMSSecurityService {
    private static instance;
    private readonly PREMIUM_PATTERNS;
    private readonly EXTENDED_PREMIUM_PATTERNS;
    private readonly SUSPICIOUS_NUMBER_CHARACTERISTICS;
    private readonly SUSPICIOUS_CONTENT_PATTERNS;
    private rateLimitStore;
    static getInstance(): SMSSecurityService;
    validateSMSRequest(phoneNumber: string, message: string, userId: string, ipAddress?: string): Promise<SMSSecurityCheck>;
    private analyzeDestination;
    private analyzePhoneNumber;
    private analyzeMessageContent;
    private checkRateLimit;
    private analyzeBehaviorPatterns;
    private maskPhoneNumber;
    private maskIP;
    getSecurityStats(): any;
    cleanupRateLimits(): void;
}
export default SMSSecurityService;
//# sourceMappingURL=SMSSecurityService.d.ts.map