"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rbac_1 = require("../middleware/rbac");
const SMSSecurityService_1 = require("../services/SMSSecurityService");
const SMSActivityService_1 = require("../services/SMSActivityService");
const logger_1 = __importDefault(require("../utils/logger"));
const types_1 = require("../types");
const config_1 = __importDefault(require("../utils/config"));
const router = (0, express_1.Router)();
const smsSecurityService = SMSSecurityService_1.SMSSecurityService.getInstance();
const smsActivityService = new SMSActivityService_1.SMSActivityService();
const db = require('../models/RedisModels').db;
router.get('/dashboard', rbac_1.requireAdmin, async (req, res, next) => {
    try {
        const securityAlerts = await getSecurityAlerts();
        const systemStats = await getSystemStats();
        const recentActivities = await getRecentAdminActivities();
        const activeUsers = await getActiveUsersCount();
        const response = {
            success: true,
            data: {
                securityAlerts,
                systemStats,
                recentActivities,
                activeUsers,
                serverStatus: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    version: config_1.default.app.version,
                    environment: config_1.default.app.environment
                }
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        res.json(response);
    }
    catch (error) {
        logger_1.default.error('❌ Admin dashboard error:', error);
        next(error);
    }
});
router.get('/users', rbac_1.requireAdmin, (0, rbac_1.requirePermission)([rbac_1.Permission.USERS_READ]), async (req, res, next) => {
    try {
        const users = await new Promise((resolve, reject) => {
            db.db.all(`
          SELECT 
            id, email, first_name, last_name, role, 
            is_active, email_verified, created_at, updated_at,
            last_login_at
          FROM users 
          ORDER BY created_at DESC
        `, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
        const response = {
            success: true,
            data: {
                users: users.map(user => ({
                    ...user,
                    password_hash: undefined
                })),
                totalUsers: users.length,
                activeUsers: users.filter(u => u.is_active).length,
                inactiveUsers: users.filter(u => !u.is_active).length
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        res.json(response);
    }
    catch (error) {
        logger_1.default.error('❌ Admin get users error:', error);
        next(error);
    }
});
router.put('/users/:userId/status', rbac_1.requireAdmin, (0, rbac_1.requirePermission)([rbac_1.Permission.USERS_WRITE]), async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            throw new types_1.ServiceTextProError('isActive must be boolean', 'INVALID_INPUT', 400);
        }
        const targetUser = await new Promise((resolve, reject) => {
            db.db.get(`
          SELECT role FROM users WHERE id = ?
        `, [userId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
        if (targetUser?.role === 'admin') {
            throw new types_1.ServiceTextProError('Cannot disable admin users', 'ADMIN_PROTECTION', 403);
        }
        await new Promise((resolve, reject) => {
            db.db.run(`
          UPDATE users 
          SET is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [isActive ? 1 : 0, userId], function (err) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        logger_1.default.warn('👑 Admin modified user status', {
            adminId: req.user?.id,
            adminEmail: req.user?.email,
            targetUserId: userId,
            newStatus: isActive ? 'ACTIVE' : 'INACTIVE',
            action: 'USER_STATUS_CHANGE'
        });
        const response = {
            success: true,
            data: {
                userId,
                isActive,
                message: `User ${isActive ? 'enabled' : 'disabled'} successfully`
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        res.json(response);
    }
    catch (error) {
        logger_1.default.error('❌ Admin modify user status error:', error);
        next(error);
    }
});
router.get('/users/:userId/settings', rbac_1.requireAdmin, (0, rbac_1.requirePermission)([rbac_1.Permission.USERS_READ]), async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await new Promise((resolve, reject) => {
            db.db.get(`
          SELECT id, email, first_name, last_name, role, is_active
          FROM users WHERE id = ?
        `, [userId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
        if (!user) {
            throw new types_1.ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
        }
        const smsSettings = {
            isEnabled: true,
            message: 'Зает съм, ще върна обаждане след няколко минути.\n\nЗапочнете чат тук:\n[chat_link]\n\n',
            filterKnownContacts: true,
            sentCount: 0
        };
        const smsStats = await smsActivityService.getUserStats(userId);
        logger_1.default.info('📢 Should notify user of admin access', {
            targetUserId: userId,
            adminId: req.user?.id,
            action: 'SETTINGS_ACCESS'
        });
        const response = {
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    isActive: user.is_active
                },
                smsSettings,
                smsStats,
                adminAccess: {
                    accessedBy: req.user?.email,
                    accessTime: new Date(),
                    reason: 'Admin dashboard access'
                }
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        res.json(response);
    }
    catch (error) {
        logger_1.default.error('❌ Admin get user settings error:', error);
        next(error);
    }
});
router.get('/security/alerts', rbac_1.requireAdmin, async (req, res, next) => {
    try {
        const alerts = await getSecurityAlerts();
        const response = {
            success: true,
            data: {
                alerts,
                summary: {
                    total: alerts.length,
                    critical: alerts.filter(a => a.severity === 'critical').length,
                    high: alerts.filter(a => a.severity === 'high').length,
                    medium: alerts.filter(a => a.severity === 'medium').length
                }
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        res.json(response);
    }
    catch (error) {
        logger_1.default.error('❌ Admin security alerts error:', error);
        next(error);
    }
});
async function getSecurityAlerts() {
    return [
        {
            id: 'alert-1',
            type: 'PREMIUM_NUMBER_BLOCK',
            severity: 'critical',
            message: 'Premium number 0900123456 blocked',
            userId: 'user-123',
            timestamp: new Date(Date.now() - 1000 * 60 * 30),
            details: {
                phoneNumber: '0900***456',
                layer: 'Layer 1',
                riskLevel: 'critical'
            }
        },
        {
            id: 'alert-2',
            type: 'SUSPICIOUS_ACTIVITY',
            severity: 'high',
            message: 'Rapid SMS attempts detected',
            userId: 'user-456',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
            details: {
                attemptCount: 15,
                timeWindow: '5 minutes'
            }
        }
    ];
}
async function getSystemStats() {
    return {
        totalUsers: 150,
        activeUsers: 142,
        smsBlocked: 23,
        smsAllowed: 1247,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    };
}
async function getRecentAdminActivities() {
    return [
        {
            id: 'activity-1',
            adminId: 'admin-user-id-12345',
            action: 'USER_STATUS_CHANGE',
            targetUserId: 'user-789',
            timestamp: new Date(Date.now() - 1000 * 60 * 15),
            details: 'Disabled user account'
        }
    ];
}
async function getActiveUsersCount() {
    return new Promise((resolve, reject) => {
        db.db.get(`
      SELECT COUNT(*) as count FROM users WHERE is_active = 1
    `, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row?.count || 0);
        });
    });
}
router.get('/security/dashboard', rbac_1.requireAdmin, async (req, res, next) => {
    try {
        const { getSecurityDashboard } = await Promise.resolve().then(() => __importStar(require('./securityController')));
        return getSecurityDashboard[1](req, res, next);
    }
    catch (error) {
        next(error);
    }
});
router.get('/security/alerts', rbac_1.requireAdmin, async (req, res, next) => {
    try {
        const { getSecurityAlerts } = await Promise.resolve().then(() => __importStar(require('./securityController')));
        return getSecurityAlerts[1](req, res, next);
    }
    catch (error) {
        next(error);
    }
});
router.post('/security/test-sms', rbac_1.requireAdmin, async (req, res, next) => {
    try {
        const { testSMSSecurity } = await Promise.resolve().then(() => __importStar(require('./securityController')));
        return testSMSSecurity[1](req, res, next);
    }
    catch (error) {
        next(error);
    }
});
router.get('/security/config', rbac_1.requireAdmin, async (req, res, next) => {
    try {
        const { getSecurityConfig } = await Promise.resolve().then(() => __importStar(require('./securityController')));
        return getSecurityConfig[1](req, res, next);
    }
    catch (error) {
        next(error);
    }
});
router.post('/security/cleanup', rbac_1.requireAdmin, async (req, res, next) => {
    try {
        const { cleanupSecurity } = await Promise.resolve().then(() => __importStar(require('./securityController')));
        return cleanupSecurity[1](req, res, next);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=adminController.js.map