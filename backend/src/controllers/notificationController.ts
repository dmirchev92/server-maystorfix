import { Request, Response } from 'express';
import NotificationService from '../services/NotificationService';
import logger from '../utils/logger';

const notificationService = new NotificationService();

/**
 * Get notifications for authenticated user
 */
export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id; // From auth middleware
    const { page = 1, limit = 20 } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
      return;
    }

    const result = await notificationService.getUserNotifications(
      userId,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: {
        notifications: result.notifications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.total,
          totalPages: Math.ceil(result.total / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('❌ Error getting user notifications:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get notifications'
      }
    });
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
      return;
    }

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count }
    });

  } catch (error) {
    logger.error('❌ Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get unread count'
      }
    });
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { notificationId } = req.params;

    logger.info('🔔 markAsRead endpoint called', { userId, notificationId, params: req.params });

    if (!userId) {
      logger.warn('🔔 markAsRead: No userId');
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
      return;
    }

    if (!notificationId) {
      logger.warn('🔔 markAsRead: No notificationId');
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Notification ID is required'
        }
      });
      return;
    }

    logger.info('🔔 Calling notificationService.markAsRead', { notificationId, userId });
    await notificationService.markAsRead(notificationId, userId);

    logger.info('🔔 markAsRead completed successfully', { notificationId, userId });
    res.json({
      success: true,
      data: {
        message: 'Notification marked as read'
      }
    });

  } catch (error) {
    logger.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark notification as read'
      }
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    logger.info('🔔 markAllAsRead endpoint called', { userId });

    if (!userId) {
      logger.warn('🔔 markAllAsRead: No userId');
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
      return;
    }

    logger.info('🔔 Calling notificationService.markAllAsRead', { userId });
    await notificationService.markAllAsRead(userId);

    logger.info('🔔 markAllAsRead completed successfully', { userId });
    res.json({
      success: true,
      data: {
        message: 'All notifications marked as read'
      }
    });

  } catch (error) {
    logger.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark all notifications as read'
      }
    });
  }
};

/**
 * Create test notification (for development)
 */
export const createTestNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { type = 'test', title = 'Test Notification', message = 'This is a test notification' } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
      return;
    }

    const notificationId = await notificationService.createNotification(
      userId,
      type,
      title,
      message,
      { test: true }
    );

    res.json({
      success: true,
      data: {
        notificationId,
        message: 'Test notification created'
      }
    });

  } catch (error) {
    logger.error('❌ Error creating test notification:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create test notification'
      }
    });
  }
};

export { notificationService };
