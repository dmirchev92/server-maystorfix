"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAdminUserAccess = exports.requireAdmin = void 0;
const auth_1 = require("./auth");
const logger_1 = __importDefault(require("../utils/logger"));
const requireAdmin = async (req, res, next) => {
    try {
        await new Promise((resolve, reject) => {
            (0, auth_1.authenticateToken)(req, res, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        if (!req.user || req.user.role !== 'admin') {
            logger_1.default.warn('🚨 Unauthorized admin access attempt', {
                userId: req.user?.id || 'unknown',
                email: req.user?.email || 'unknown',
                role: req.user?.role || 'none',
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path,
                method: req.method
            });
            res.status(403).json({
                success: false,
                error: {
                    code: 'ADMIN_ACCESS_DENIED',
                    message: 'Admin privileges required'
                }
            });
            return;
        }
        logger_1.default.info('👑 Admin access granted', {
            adminId: req.user.id,
            adminEmail: req.user.email,
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        req.adminAccess = {
            accessTime: new Date(),
            action: `${req.method} ${req.path}`
        };
        next();
    }
    catch (error) {
        logger_1.default.error('❌ Admin authentication error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'ADMIN_AUTH_ERROR',
                message: 'Admin authentication failed'
            }
        });
    }
};
exports.requireAdmin = requireAdmin;
const logAdminUserAccess = (action) => {
    return (req, res, next) => {
        const targetUserId = req.params.userId || req.body.userId || req.query.userId;
        if (targetUserId && req.user) {
            logger_1.default.warn('🔍 Admin accessing user data', {
                adminId: req.user.id,
                adminEmail: req.user.email,
                targetUserId: targetUserId,
                action: action,
                path: req.path,
                method: req.method,
                ip: req.ip,
                timestamp: new Date().toISOString()
            });
            req.adminAccess = {
                accessTime: new Date(),
                targetUserId: targetUserId,
                action: action
            };
        }
        next();
    };
};
exports.logAdminUserAccess = logAdminUserAccess;
exports.default = {
    requireAdmin: exports.requireAdmin,
    logAdminUserAccess: exports.logAdminUserAccess
};
//# sourceMappingURL=adminAuth.js.map