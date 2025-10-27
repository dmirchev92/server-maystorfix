import { Request, Response, NextFunction } from 'express';
export declare class SecurityController {
    private securityService;
    private smsSecurityService;
    constructor();
    getSecurityDashboard(req: Request, res: Response, next: NextFunction): Promise<void>;
    getSecurityAlerts(req: Request, res: Response, next: NextFunction): Promise<void>;
    testSMSSecurity(req: Request, res: Response, next: NextFunction): Promise<void>;
    getSecurityConfig(req: Request, res: Response, next: NextFunction): Promise<void>;
    cleanupSecurity(req: Request, res: Response, next: NextFunction): Promise<void>;
    getRealtimeMetrics(req: Request, res: Response, next: NextFunction): Promise<void>;
    private calculateThreatTrends;
    private getSystemHealthMetrics;
    private formatThreatMessage;
    private maskIP;
}
declare const securityController: SecurityController;
export declare const getSecurityDashboard: any[];
export declare const getSecurityAlerts: any[];
export declare const testSMSSecurity: any[];
export declare const getSecurityConfig: any[];
export declare const cleanupSecurity: any[];
export declare const getRealtimeMetrics: any[];
export default securityController;
//# sourceMappingURL=securityController.d.ts.map