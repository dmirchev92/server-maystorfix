// Admin Controller - Dashboard and User Management
import { Router, Request, Response, NextFunction } from 'express';
import { requireAdmin, requirePermission, Permission, RBACRequest } from '../middleware/rbac';
import { SMSSecurityService } from '../services/SMSSecurityService';
import { SMSActivityService } from '../services/SMSActivityService';
import logger from '../utils/logger';
import { APIResponse, ServiceTextProError } from '../types';
import config from '../utils/config';
const router = Router();
const smsSecurityService = SMSSecurityService.getInstance();
const smsActivityService = new SMSActivityService();

// Use the same database instance pattern as other services
const db = require('../models/RedisModels').db;

/**
 * GET /api/v1/admin/dashboard
 * Get admin dashboard with security alerts and system stats
 */
router.get('/dashboard',
  requireAdmin,
  async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      // Get security alerts from last 24 hours
      const securityAlerts = await getSecurityAlerts();
      
      // Get system statistics
      const systemStats = await getSystemStats();
      
      // Get recent admin activities
      const recentActivities = await getRecentAdminActivities();
      
      // Get active users count
      const activeUsers = await getActiveUsersCount();

      const response: APIResponse = {
        success: true,
        data: {
          securityAlerts,
          systemStats,
          recentActivities,
          activeUsers,
          serverStatus: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: config.app.version,
            environment: config.app.environment
          }
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('❌ Admin dashboard error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/users
 * Get all users for management
 */
router.get('/users',
  requireAdmin,
  requirePermission([Permission.USERS_READ]),
  async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      const users = await new Promise<any[]>((resolve, reject) => {
        db.db.all(`
          SELECT 
            id, email, first_name, last_name, role, 
            is_active, email_verified, created_at, updated_at,
            last_login_at
          FROM users 
          ORDER BY created_at DESC
        `, (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      const response: APIResponse = {
        success: true,
        data: {
          users: users.map(user => ({
            ...user,
            // Don't expose password hash
            password_hash: undefined
          })),
          totalUsers: users.length,
          activeUsers: users.filter(u => u.is_active).length,
          inactiveUsers: users.filter(u => !u.is_active).length
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('❌ Admin get users error:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/v1/admin/users/:userId/status
 * Enable/disable user account
 */
router.put('/users/:userId/status',
  requireAdmin,
  requirePermission([Permission.USERS_WRITE]),
  async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        throw new ServiceTextProError('isActive must be boolean', 'INVALID_INPUT', 400);
      }

      // Don't allow disabling admin users
      const targetUser = await new Promise<any>((resolve, reject) => {
        db.db.get(`
          SELECT role FROM users WHERE id = ?
        `, [userId], (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (targetUser?.role === 'admin') {
        throw new ServiceTextProError('Cannot disable admin users', 'ADMIN_PROTECTION', 403);
      }

      // Update user status
      await new Promise<void>((resolve, reject) => {
        db.db.run(`
          UPDATE users 
          SET is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [isActive ? 1 : 0, userId], function(err: any) {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.warn('👑 Admin modified user status', {
        adminId: req.user?.id,
        adminEmail: req.user?.email,
        targetUserId: userId,
        newStatus: isActive ? 'ACTIVE' : 'INACTIVE',
        action: 'USER_STATUS_CHANGE'
      });

      const response: APIResponse = {
        success: true,
        data: {
          userId,
          isActive,
          message: `User ${isActive ? 'enabled' : 'disabled'} successfully`
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('❌ Admin modify user status error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/users/:userId/settings
 * Get user's settings (with notification to user)
 */
router.get('/users/:userId/settings',
  requireAdmin,
  requirePermission([Permission.USERS_READ]),
  async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      // Get user info
      const user = await new Promise<any>((resolve, reject) => {
        db.db.get(`
          SELECT id, email, first_name, last_name, role, is_active
          FROM users WHERE id = ?
        `, [userId], (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!user) {
        throw new ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
      }

      // Get SMS settings (mock for now - would come from actual SMS config table)
      const smsSettings = {
        isEnabled: true,
        message: 'Зает съм, ще върна обаждане след няколко минути.\n\nЗапочнете чат тук:\n[chat_link]\n\n',
        filterKnownContacts: true,
        sentCount: 0
      };

      // Get SMS activity stats
      const smsStats = await smsActivityService.getUserStats(userId);

      // TODO: Send real-time notification to user about admin access
      logger.info('📢 Should notify user of admin access', {
        targetUserId: userId,
        adminId: req.user?.id,
        action: 'SETTINGS_ACCESS'
      });

      const response: APIResponse = {
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
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('❌ Admin get user settings error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/security/alerts
 * Get recent security alerts
 */
router.get('/security/alerts',
  requireAdmin,
  async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      const alerts = await getSecurityAlerts();

      const response: APIResponse = {
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
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('❌ Admin security alerts error:', error);
      next(error);
    }
  }
);

// Helper functions
async function getSecurityAlerts() {
  // This would query your logs/database for security events
  // For now, return mock data
  return [
    {
      id: 'alert-1',
      type: 'PREMIUM_NUMBER_BLOCK',
      severity: 'critical',
      message: 'Premium number 0900123456 blocked',
      userId: 'user-123',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
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
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
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
      timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 min ago
      details: 'Disabled user account'
    }
  ];
}

async function getActiveUsersCount() {
  return new Promise<number>((resolve, reject) => {
    db.db.get(`
      SELECT COUNT(*) as count FROM users WHERE is_active = 1
    `, (err: any, row: any) => {
      if (err) reject(err);
      else resolve(row?.count || 0);
    });
  });
}

// 🔒 ENHANCED SECURITY ROUTES
/**
 * GET /api/v1/admin/security/dashboard
 * Get comprehensive security dashboard
 */
router.get('/security/dashboard',
  requireAdmin,
  async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      // Import security controller dynamically to avoid conflicts
      const { getSecurityDashboard } = await import('./securityController');
      return getSecurityDashboard[1](req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/security/alerts
 * Get security alerts with filtering
 */
router.get('/security/alerts',
  requireAdmin,
  async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      const { getSecurityAlerts } = await import('./securityController');
      return getSecurityAlerts[1](req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/admin/security/test-sms
 * Test SMS security system
 */
router.post('/security/test-sms',
  requireAdmin,
  async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      const { testSMSSecurity } = await import('./securityController');
      return testSMSSecurity[1](req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/security/config
 * Get security configuration
 */
router.get('/security/config',
  requireAdmin,
  async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      const { getSecurityConfig } = await import('./securityController');
      return getSecurityConfig[1](req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/admin/security/cleanup
 * Trigger security system cleanup
 */
router.post('/security/cleanup',
  requireAdmin,
  async (req: RBACRequest, res: Response, next: NextFunction) => {
    try {
      const { cleanupSecurity } = await import('./securityController');
      return cleanupSecurity[1](req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
