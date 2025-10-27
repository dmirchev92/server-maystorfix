// Admin Authentication Middleware
import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from './auth';
import logger from '../utils/logger';

export interface AdminRequest extends Request {
  user?: any; // Use any to avoid type conflicts
  adminAccess?: {
    accessTime: Date;
    targetUserId?: string;
    action: string;
  };
}

/**
 * Middleware to ensure user is authenticated and has admin role
 */
export const requireAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // First check if user is authenticated
    await new Promise<void>((resolve, reject) => {
      authenticateToken(req, res, (err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check if user has admin role
    if (!req.user || req.user.role !== 'admin') {
      logger.warn('🚨 Unauthorized admin access attempt', {
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

    // Log admin access
    logger.info('👑 Admin access granted', {
      adminId: req.user.id,
      adminEmail: req.user.email,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Set admin access info for logging
    req.adminAccess = {
      accessTime: new Date(),
      action: `${req.method} ${req.path}`
    };

    next();

  } catch (error) {
    logger.error('❌ Admin authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ADMIN_AUTH_ERROR',
        message: 'Admin authentication failed'
      }
    });
  }
};

/**
 * Middleware to log admin actions on user data
 */
export const logAdminUserAccess = (action: string) => {
  return (req: AdminRequest, res: Response, next: NextFunction): void => {
    const targetUserId = req.params.userId || req.body.userId || req.query.userId;
    
    if (targetUserId && req.user) {
      logger.warn('🔍 Admin accessing user data', {
        adminId: req.user.id,
        adminEmail: req.user.email,
        targetUserId: targetUserId,
        action: action,
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      // Store for potential user notification
      req.adminAccess = {
        accessTime: new Date(),
        targetUserId: targetUserId as string,
        action: action
      };

      // TODO: Send real-time notification to target user
      // This will be implemented with WebSocket/Socket.IO
    }

    next();
  };
};

export default {
  requireAdmin,
  logAdminUserAccess
};
