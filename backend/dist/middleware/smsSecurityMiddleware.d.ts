import { Request, Response, NextFunction } from 'express';
export interface SMSSecurityRequest extends Request {
    smsSecurityCheck?: {
        isAllowed: boolean;
        riskLevel: string;
        reason?: string;
    };
}
export declare const validateSMSRequest: (req: SMSSecurityRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const logSuccessfulSMS: (req: SMSSecurityRequest, phoneNumber: string, message: string) => Promise<void>;
declare const _default: {
    validateSMSRequest: (req: SMSSecurityRequest, res: Response, next: NextFunction) => Promise<void>;
    logSuccessfulSMS: (req: SMSSecurityRequest, phoneNumber: string, message: string) => Promise<void>;
};
export default _default;
//# sourceMappingURL=smsSecurityMiddleware.d.ts.map