export interface SMSActivityRecord {
    id: string;
    userId: string;
    phoneNumber: string;
    messageLength: number;
    timestamp: string;
    ipAddress?: string;
    success: boolean;
    riskLevel?: string;
}
export interface SMSActivityStats {
    todayCount: number;
    thisHourCount: number;
    totalCount: number;
    successRate: number;
    blockedCount: number;
    lastActivity?: string;
}
export interface SMSLimitCheck {
    canSend: boolean;
    reason?: string;
    stats: SMSActivityStats;
}
export declare class SMSActivityService {
    private database;
    private isPostgreSQL;
    constructor();
    private initializeDatabase;
    logActivity(activity: Omit<SMSActivityRecord, 'id' | 'timestamp'>): Promise<void>;
    getUserStats(userId: string): Promise<SMSActivityStats>;
    canUserSendSMS(userId: string): Promise<SMSLimitCheck>;
    detectSuspiciousActivity(userId: string): Promise<{
        isSuspicious: boolean;
        reasons: string[];
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
    }>;
    private analyzeRecentPatterns;
    getActivitySummary(timeframe?: '1h' | '24h' | '7d' | '30d'): Promise<any>;
    cleanupOldLogs(): Promise<number>;
    private maskPhoneNumber;
    private maskIP;
}
export default SMSActivityService;
//# sourceMappingURL=SMSActivityService.d.ts.map