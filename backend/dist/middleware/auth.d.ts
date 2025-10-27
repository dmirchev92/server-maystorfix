import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                role: string;
                businessId?: string;
                firstName: string;
                lastName: string;
                phoneNumber: string;
                status: string;
                createdAt: Date;
                lastLoginAt?: Date;
                isGdprCompliant: boolean;
                dataRetentionUntil: Date;
                gdprConsents: any[];
                updatedAt: Date;
            };
        }
    }
}
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map