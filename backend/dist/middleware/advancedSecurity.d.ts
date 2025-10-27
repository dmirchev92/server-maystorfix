import { Request, Response, NextFunction } from 'express';
import SecurityEnhancementService from '../services/SecurityEnhancementService';
export interface SecureRequest extends Request {
    securityContext?: {
        riskScore: number;
        deviceTrusted: boolean;
        isNewDevice: boolean;
        threatLevel: 'low' | 'medium' | 'high' | 'critical';
    };
}
export declare const createAdaptiveRateLimit: (options: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests?: boolean;
}) => import("express-rate-limit").RateLimitRequestHandler;
export declare const progressiveDelay: import("express-rate-limit").RateLimitRequestHandler;
export declare const loginSecurity: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const deviceFingerprinting: (req: SecureRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const geolocationSecurity: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const apiAbuseProtection: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const inputSanitization: (req: Request, res: Response, next: NextFunction) => void;
export declare const enhancedSecurityHeaders: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare const suspiciousActivityDetector: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const adminSecurity: (import("express-rate-limit").RateLimitRequestHandler | ((req: SecureRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>) | ((req: SecureRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>))[];
export declare const rateLimits: {
    auth: import("express-rate-limit").RateLimitRequestHandler;
    sms: import("express-rate-limit").RateLimitRequestHandler;
    general: import("express-rate-limit").RateLimitRequestHandler;
    admin: import("express-rate-limit").RateLimitRequestHandler;
};
export { SecurityEnhancementService };
//# sourceMappingURL=advancedSecurity.d.ts.map