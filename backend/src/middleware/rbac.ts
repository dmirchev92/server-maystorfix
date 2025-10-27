// Industry Standard RBAC (Role-Based Access Control) Middleware
import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from './auth';
import logger from '../utils/logger';

export interface RBACRequest extends Request {
  user?: any; // Simplified to avoid type conflicts
}

/**
 * Industry Standard Role Definitions
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin', 
  MODERATOR = 'moderator',
  SERVICE_PROVIDER = 'service_provider',
  CUSTOMER = 'customer'
}

/**
 * Permission Categories (Industry Standard)
 */
export enum Permission {
  // User Management
  USERS_READ = 'users.read',
  USERS_WRITE = 'users.write',
  USERS_DELETE = 'users.delete',
  
  // System Administration
  SYSTEM_MANAGE = 'system.manage',
  SECURITY_MANAGE = 'security.manage',
  
  // SMS Management
  SMS_SEND = 'sms.send',
  SMS_MANAGE = 'sms.manage',
  SMS_VIEW_LOGS = 'sms.view_logs',
  
  // Analytics
  ANALYTICS_READ = 'analytics.read',
  ANALYTICS_MANAGE = 'analytics.manage',
  
  // Profile Management
  PROFILE_READ = 'profile.read',
  PROFILE_UPDATE = 'profile.update',
  
  // Business Management
  BUSINESS_MANAGE = 'business.manage',
  
  // Admin Wildcard
  ADMIN_ALL = 'admin.*'
}

/**
 * Role-based access control middleware
 * Industry standard implementation
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // First authenticate the user
      await new Promise<void>((resolve, reject) => {
        authenticateToken(req, res, (err?: any) => {
          if (err) reject(err);
          else resolve();
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

      // Check if user has required role
      if (!allowedRoles.includes(req.user.role as UserRole)) {
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

      // Log successful access
      await logSecurityEvent(req, 'ROLE_ACCESS_GRANTED', {
        allowedRoles,
        userRole: req.user.role
      });

      next();

    } catch (error) {
      logger.error('❌ RBAC role check failed:', error);
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

/**
 * Permission-based access control middleware
 * Granular permission checking
 */
export const requirePermission = (requiredPermissions: Permission[]) => {
  return async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // First authenticate the user
      await new Promise<void>((resolve, reject) => {
        authenticateToken(req, res, (err?: any) => {
          if (err) reject(err);
          else resolve();
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

      // Load user permissions if not already loaded
      if (!req.user.permissions) {
        req.user.permissions = await getUserPermissions(req.user.id);
      }

      // Check permissions
      const hasPermission = await checkUserPermissions(
        req.user.id, 
        req.user.role, 
        req.user.permissions, 
        requiredPermissions
      );

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

      // Log successful access
      await logSecurityEvent(req, 'PERMISSION_ACCESS_GRANTED', {
        requiredPermissions,
        userRole: req.user.role
      });

      next();

    } catch (error) {
      logger.error('❌ RBAC permission check failed:', error);
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

/**
 * Admin-only access (Industry Standard)
 */
export const requireAdmin = requireRole([UserRole.ADMIN]);

/**
 * Admin or Moderator access
 */
export const requireAdminOrModerator = requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

/**
 * Service Provider access
 */
export const requireServiceProvider = requireRole([UserRole.SERVICE_PROVIDER, UserRole.ADMIN]);

/**
 * Get user permissions from database
 */
async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const db = require('../models/RedisModels').db;
    
    return new Promise<string[]>((resolve, reject) => {
      db.db.all(`
        SELECT permission 
        FROM user_permissions 
        WHERE user_id = ? 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `, [userId], (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const permissions = rows.map(row => row.permission);
          resolve(permissions);
        }
      });
    });
  } catch (error) {
    logger.error('❌ Failed to get user permissions:', error);
    return [];
  }
}

/**
 * Check if user has required permissions
 */
async function checkUserPermissions(
  userId: string, 
  userRole: string, 
  userPermissions: string[], 
  requiredPermissions: Permission[]
): Promise<boolean> {
  // Admin has all permissions
  if (userRole === UserRole.ADMIN || userPermissions.includes(Permission.ADMIN_ALL)) {
    return true;
  }

  // Check specific permissions
  for (const required of requiredPermissions) {
    if (userPermissions.includes(required)) {
      return true;
    }
    
    // Check wildcard permissions (e.g., 'users.*' covers 'users.read')
    const category = required.split('.')[0];
    if (userPermissions.includes(`${category}.*`)) {
      return true;
    }
  }

  return false;
}

/**
 * Log security events for audit trail
 */
async function logSecurityEvent(
  req: RBACRequest, 
  action: string, 
  details: any
): Promise<void> {
  try {
    const db = require('../models/RedisModels').db;
    const eventId = 'sec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    await new Promise<void>((resolve, reject) => {
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
      ], function(err: any) {
        if (err) {
          logger.error('❌ Failed to log security event:', err);
          resolve(); // Don't fail the request if logging fails
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    logger.error('❌ Security event logging failed:', error);
  }
}

export default {
  requireRole,
  requirePermission,
  requireAdmin,
  requireAdminOrModerator,
  requireServiceProvider,
  UserRole,
  Permission
};
