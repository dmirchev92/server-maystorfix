import { Request, Response, NextFunction } from 'express';
export interface AdminRequest extends Request {
    user?: any;
    adminAccess?: {
        accessTime: Date;
        targetUserId?: string;
        action: string;
    };
}
export declare const requireAdmin: (req: AdminRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const logAdminUserAccess: (action: string) => (req: AdminRequest, res: Response, next: NextFunction) => void;
declare const _default: {
    requireAdmin: (req: AdminRequest, res: Response, next: NextFunction) => Promise<void>;
    logAdminUserAccess: (action: string) => (req: AdminRequest, res: Response, next: NextFunction) => void;
};
export default _default;
//# sourceMappingURL=adminAuth.d.ts.map