"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireServiceProvider = exports.requireAdminOrModerator = exports.requireAdmin = exports.requirePermission = exports.requireRole = exports.Permission = exports.UserRole = void 0;
const auth_1 = require("./auth");
const logger_1 = __importDefault(require("../utils/logger"));
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
    UserRole["MODERATOR"] = "moderator";
    UserRole["SERVICE_PROVIDER"] = "service_provider";
    UserRole["CUSTOMER"] = "customer";
})(UserRole || (exports.UserRole = UserRole = {}));
var Permission;
(function (Permission) {
    Permission["USERS_READ"] = "users.read";
    Permission["USERS_WRITE"] = "users.write";
    Permission["USERS_DELETE"] = "users.delete";
    Permission["SYSTEM_MANAGE"] = "system.manage";
    Permission["SECURITY_MANAGE"] = "security.manage";
    Permission["SMS_SEND"] = "sms.send";
    Permission["SMS_MANAGE"] = "sms.manage";
    Permission["SMS_VIEW_LOGS"] = "sms.view_logs";
    Permission["ANALYTICS_READ"] = "analytics.read";
    Permission["ANALYTICS_MANAGE"] = "analytics.manage";
    Permission["PROFILE_READ"] = "profile.read";
    Permission["PROFILE_UPDATE"] = "profile.update";
    Permission["BUSINESS_MANAGE"] = "business.manage";
    Permission["ADMIN_ALL"] = "admin.*";
})(Permission || (exports.Permission = Permission = {}));
const requireRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            await new Promise((resolve, reject) => {
                (0, auth_1.authenticateToken)(req, res, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'AUTHENTICATION_REQUIRED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            if (!allowedRoles.includes(req.user.role)) {
                await logSecurityEvent(req, 'UNAUTHORIZED_ROLE_ACCESS', {
                    requiredRoles: allowedRoles,
                    userRole: req.user.role
                });
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_ROLE',
                        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
                    }
                });
                return;
            }
            await logSecurityEvent(req, 'ROLE_ACCESS_GRANTED', {
                allowedRoles,
                userRole: req.user.role
            });
            next();
        }
        catch (error) {
            logger_1.default.error('❌ RBAC role check failed:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'RBAC_ERROR',
                    message: 'Role verification failed'
                }
            });
        }
    };
};
exports.requireRole = requireRole;
const requirePermission = (requiredPermissions) => {
    return async (req, res, next) => {
        try {
            await new Promise((resolve, reject) => {
                (0, auth_1.authenticateToken)(req, res, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'AUTHENTICATION_REQUIRED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            if (!req.user.permissions) {
                req.user.permissions = await getUserPermissions(req.user.id);
            }
            const hasPermission = await checkUserPermissions(req.user.id, req.user.role, req.user.permissions, requiredPermissions);
            if (!hasPermission) {
                await logSecurityEvent(req, 'UNAUTHORIZED_PERMISSION_ACCESS', {
                    requiredPermissions,
                    userPermissions: req.user.permissions
                });
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: `Access denied. Required permission: ${requiredPermissions.join(' or ')}`
                    }
                });
                return;
            }
            await logSecurityEvent(req, 'PERMISSION_ACCESS_GRANTED', {
                requiredPermissions,
                userRole: req.user.role
            });
            next();
        }
        catch (error) {
            logger_1.default.error('❌ RBAC permission check failed:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'RBAC_ERROR',
                    message: 'Permission verification failed'
                }
            });
        }
    };
};
exports.requirePermission = requirePermission;
exports.requireAdmin = (0, exports.requireRole)([UserRole.ADMIN]);
exports.requireAdminOrModerator = (0, exports.requireRole)([UserRole.ADMIN, UserRole.MODERATOR]);
exports.requireServiceProvider = (0, exports.requireRole)([UserRole.SERVICE_PROVIDER, UserRole.ADMIN]);
async function getUserPermissions(userId) {
    try {
        const db = require('../models/RedisModels').db;
        return new Promise((resolve, reject) => {
            db.db.all(`
        SELECT permission 
        FROM user_permissions 
        WHERE user_id = ? 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    const permissions = rows.map(row => row.permission);
                    resolve(permissions);
                }
            });
        });
    }
    catch (error) {
        logger_1.default.error('❌ Failed to get user permissions:', error);
        return [];
    }
}
async function checkUserPermissions(userId, userRole, userPermissions, requiredPermissions) {
    if (userRole === UserRole.ADMIN || userPermissions.includes(Permission.ADMIN_ALL)) {
        return true;
    }
    for (const required of requiredPermissions) {
        if (userPermissions.includes(required)) {
            return true;
        }
        const category = required.split('.')[0];
        if (userPermissions.includes(`${category}.*`)) {
            return true;
        }
    }
    return false;
}
async function logSecurityEvent(req, action, details) {
    try {
        const db = require('../models/RedisModels').db;
        const eventId = 'sec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        await new Promise((resolve, reject) => {
            db.db.run(`
        INSERT INTO admin_activity_log (
          id, admin_user_id, action, target_resource, 
          ip_address, user_agent, details, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                eventId,
                req.user?.id || 'unknown',
                action,
                req.path,
                req.ip || 'unknown',
                req.get('User-Agent') || 'unknown',
                JSON.stringify(details),
                new Date().toISOString()
            ], function (err) {
                if (err) {
                    logger_1.default.error('❌ Failed to log security event:', err);
                    resolve();
                }
                else {
                    resolve();
                }
            });
        });
    }
    catch (error) {
        logger_1.default.error('❌ Security event logging failed:', error);
    }
}
exports.default = {
    requireRole: exports.requireRole,
    requirePermission: exports.requirePermission,
    requireAdmin: exports.requireAdmin,
    requireAdminOrModerator: exports.requireAdminOrModerator,
    requireServiceProvider: exports.requireServiceProvider,
    UserRole,
    Permission
};
//# sourceMappingURL=rbac.js.map