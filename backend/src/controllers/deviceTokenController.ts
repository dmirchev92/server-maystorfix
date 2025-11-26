import { Request, Response } from 'express';
import { FCMService } from '../services/FCMService';
import logger from '../utils/logger';

const fcmService = FCMService.getInstance();

/**
 * Register a new device token
 * POST /api/v1/device-tokens/register
 */
export const registerDeviceToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, platform, deviceInfo } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    if (!token || !platform) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Token and platform are required',
        },
      });
      return;
    }

    if (!['android', 'ios'].includes(platform)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Platform must be either "android" or "ios"',
        },
      });
      return;
    }

    logger.info('📱 Registering device token', { userId, platform });

    const tokenId = await fcmService.registerDeviceToken(
      userId,
      token,
      platform,
      deviceInfo
    );

    res.json({
      success: true,
      data: {
        tokenId,
        message: 'Device token registered successfully',
      },
    });
  } catch (error) {
    logger.error('❌ Error registering device token:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register device token',
      },
    });
  }
};

/**
 * Delete a device token
 * DELETE /api/v1/device-tokens/:tokenId
 */
export const deleteDeviceToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    if (!tokenId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Token ID is required',
        },
      });
      return;
    }

    logger.info('🗑️ Deleting device token', { userId, tokenId });

    await fcmService.deleteDeviceToken(tokenId, userId);

    res.json({
      success: true,
      data: {
        message: 'Device token deleted successfully',
      },
    });
  } catch (error) {
    logger.error('❌ Error deleting device token:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete device token',
      },
    });
  }
};

/**
 * Get all device tokens for the authenticated user
 * GET /api/v1/device-tokens
 */
export const getUserDeviceTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    logger.info('📱 Getting device tokens for user', { userId });

    const tokens = await fcmService.getUserTokens(userId);

    // Don't expose full tokens in response
    const sanitizedTokens = tokens.map(t => ({
      id: t.id,
      platform: t.platform,
      isActive: t.is_active,
      tokenPreview: t.token.substring(0, 20) + '...',
    }));

    res.json({
      success: true,
      data: {
        tokens: sanitizedTokens,
        count: tokens.length,
      },
    });
  } catch (error) {
    logger.error('❌ Error getting device tokens:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get device tokens',
      },
    });
  }
};

/**
 * Deactivate a device token by its value (for logout)
 * POST /api/v1/device-tokens/deactivate
 */
export const deactivateDeviceToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    if (!token) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Token is required',
        },
      });
      return;
    }

    logger.info('🔒 Deactivating device token on logout', { userId, tokenPreview: token.substring(0, 20) + '...' });

    await fcmService.deactivateTokenByValue(token, userId);

    res.json({
      success: true,
      data: {
        message: 'Device token deactivated successfully',
      },
    });
  } catch (error) {
    logger.error('❌ Error deactivating device token:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to deactivate device token',
      },
    });
  }
};

/**
 * Test push notification endpoint (for testing only)
 * POST /api/v1/device-tokens/test
 */
export const testPushNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    logger.info('🧪 Sending test push notification', { userId });

    const result = await fcmService.sendNotificationToUser(userId, {
      title: 'Test Notification',
      body: 'This is a test push notification from ServiceTextPro',
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      data: {
        message: 'Test notification sent',
        result,
      },
    });
  } catch (error) {
    logger.error('❌ Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to send test notification',
      },
    });
  }
};
