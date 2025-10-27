import { Request } from 'express';
export interface SecurityThreat {
    id: string;
    type: 'BRUTE_FORCE' | 'CREDENTIAL_STUFFING' | 'ACCOUNT_TAKEOVER' | 'API_ABUSE' | 'SUSPICIOUS_BEHAVIOR';
    severity: 'low' | 'medium' | 'high' | 'critical';
    userId?: string;
    ipAddress: string;
    userAgent?: string;
    details: any;
    timestamp: Date;
    blocked: boolean;
}
export interface DeviceFingerprint {
    id: string;
    userId: string;
    fingerprint: string;
    ipAddress: string;
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    isKnownDevice: boolean;
    firstSeen: Date;
    lastSeen: Date;
    trustScore: number;
}
export interface SecurityAlert {
    id: string;
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    userId?: string;
    ipAddress?: string;
    timestamp: Date;
    actionTaken: string;
    details: any;
}
export declare class SecurityEnhancementService {
    private static instance;
    private database;
    private readonly SUSPICIOUS_USER_AGENTS;
    private readonly SUSPICIOUS_IPS;
    private readonly HIGH_RISK_COUNTRIES;
    private failedAttempts;
    private deviceCache;
    static getInstance(): SecurityEnhancementService;
    constructor();
    private initializeSecurityTables;
    checkBruteForceProtection(email: string, ipAddress: string): Promise<{
        allowed: boolean;
        reason?: string;
        waitTime?: number;
    }>;
    recordFailedLogin(email: string, ipAddress: string): void;
    clearFailedAttempts(email: string, ipAddress: string): void;
    analyzeDeviceFingerprint(req: Request, userId: string): Promise<{
        trusted: boolean;
        isNewDevice: boolean;
        riskScore: number;
    }>;
    private generateDeviceFingerprint;
    private calculateDeviceRiskScore;
    checkGeolocationAnomaly(ipAddress: string, userId: string): Promise<{
        suspicious: boolean;
        reason?: string;
    }>;
    checkAPIAbuse(req: Request, userId?: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    private getEndpointLimits;
    private logSecurityThreat;
    private logSecurityAlert;
    private getDeviceFingerprint;
    private saveDeviceFingerprint;
    private updateDeviceLastSeen;
    getRecentSecurityThreats(limit?: number): Promise<SecurityThreat[]>;
    getSecurityStats(): Promise<any>;
    private maskEmail;
    private maskIP;
    cleanup(): Promise<void>;
}
export default SecurityEnhancementService;
//# sourceMappingURL=SecurityEnhancementService.d.ts.map