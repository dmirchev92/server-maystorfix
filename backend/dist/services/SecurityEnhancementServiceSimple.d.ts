import { Request } from 'express';
export declare class SecurityEnhancementService {
    private static instance;
    private failedAttempts;
    static getInstance(): SecurityEnhancementService;
    constructor();
    checkBruteForceProtection(email: string, ipAddress: string): Promise<{
        allowed: boolean;
        reason?: string;
        waitTime?: number;
        emailAttempts?: number;
        ipAttempts?: number;
        emailRemaining?: number;
        ipRemaining?: number;
        debugInfo?: any;
    }>;
    recordFailedLogin(email: string, ipAddress: string): void;
    clearFailedAttempts(email: string, ipAddress: string): void;
    analyzeDeviceFingerprint(req: Request, userId: string): Promise<{
        trusted: boolean;
        isNewDevice: boolean;
        riskScore: number;
    }>;
    checkAPIAbuse(req: Request, userId?: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    checkGeolocationAnomaly(ipAddress: string, userId: string): Promise<{
        suspicious: boolean;
        reason?: string;
    }>;
    getSecurityStats(): Promise<any>;
    getRecentSecurityThreats(limit?: number): Promise<any[]>;
    cleanup(): Promise<void>;
    resetAllLimits(): void;
    private maskEmail;
    private maskIP;
}
export default SecurityEnhancementService;
//# sourceMappingURL=SecurityEnhancementServiceSimple.d.ts.map