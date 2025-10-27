import winston from 'winston';
declare const logger: winston.Logger;
export declare const gdprLogger: {
    logDataAccess: (userId: string, dataType: string, purpose: string, ipAddress?: string) => void;
    logConsentChange: (userId: string, consentType: string, granted: boolean, ipAddress?: string) => void;
    logDataRetention: (dataType: string, action: "CREATED" | "UPDATED" | "DELETED", recordCount: number) => void;
    logPrivacyRightRequest: (userId: string, rightType: string, status: string) => void;
    logDataBreach: (severity: "LOW" | "MEDIUM" | "HIGH", description: string, affectedUsers?: number) => void;
};
export default logger;
export declare const createServiceLogger: (serviceName: string) => winston.Logger;
export declare const logError: (error: Error, context?: Record<string, any>) => void;
export declare const createRequestLogger: () => (req: any, res: any, next: any) => void;
//# sourceMappingURL=logger.d.ts.map