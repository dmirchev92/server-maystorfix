import { Request, Response, NextFunction } from 'express';
export interface RBACRequest extends Request {
    user?: any;
}
export declare enum UserRole {
    USER = "user",
    ADMIN = "admin",
    MODERATOR = "moderator",
    SERVICE_PROVIDER = "service_provider",
    CUSTOMER = "customer"
}
export declare enum Permission {
    USERS_READ = "users.read",
    USERS_WRITE = "users.write",
    USERS_DELETE = "users.delete",
    SYSTEM_MANAGE = "system.manage",
    SECURITY_MANAGE = "security.manage",
    SMS_SEND = "sms.send",
    SMS_MANAGE = "sms.manage",
    SMS_VIEW_LOGS = "sms.view_logs",
    ANALYTICS_READ = "analytics.read",
    ANALYTICS_MANAGE = "analytics.manage",
    PROFILE_READ = "profile.read",
    PROFILE_UPDATE = "profile.update",
    BUSINESS_MANAGE = "business.manage",
    ADMIN_ALL = "admin.*"
}
export declare const requireRole: (allowedRoles: UserRole[]) => (req: RBACRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requirePermission: (requiredPermissions: Permission[]) => (req: RBACRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireAdmin: (req: RBACRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireAdminOrModerator: (req: RBACRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireServiceProvider: (req: RBACRequest, res: Response, next: NextFunction) => Promise<void>;
declare const _default: {
    requireRole: (allowedRoles: UserRole[]) => (req: RBACRequest, res: Response, next: NextFunction) => Promise<void>;
    requirePermission: (requiredPermissions: Permission[]) => (req: RBACRequest, res: Response, next: NextFunction) => Promise<void>;
    requireAdmin: (req: RBACRequest, res: Response, next: NextFunction) => Promise<void>;
    requireAdminOrModerator: (req: RBACRequest, res: Response, next: NextFunction) => Promise<void>;
    requireServiceProvider: (req: RBACRequest, res: Response, next: NextFunction) => Promise<void>;
    UserRole: typeof UserRole;
    Permission: typeof Permission;
};
export default _default;
//# sourceMappingURL=rbac.d.ts.map