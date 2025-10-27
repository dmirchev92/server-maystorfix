// Chat Token Controller - API endpoints for chat token management
// Handles token validation, generation, and lifecycle management

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth';
import { ChatTokenService } from '../services/ChatTokenService';
import logger from '../utils/logger';
import { APIResponse, ServiceTextProError } from '../types';
import config from '../utils/config';

// Rate limiting for token generation (prevent abuse)
const tokenRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 token generations per 15 minutes per IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many token generation attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

const router = Router();
const chatTokenService = new ChatTokenService();

/**
 * GET /api/v1/chat/public/:spIdentifier/validate/:token
 * Validate and use a chat token (public endpoint, no auth required)
 */
router.get('/public/:spIdentifier/validate/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { spIdentifier, token } = req.params;

      if (!spIdentifier || !token) {
        throw new ServiceTextProError('Missing required parameters', 'MISSING_PARAMETERS', 400);
      }

      logger.info('Validating chat token', {
        spIdentifier,
        token: token.substring(0, 4) + '****',
        ip: req.ip
      });

      const result = await chatTokenService.validateAndUseToken(spIdentifier, token);

      if (!result.isValid) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: result.error || 'Token validation failed'
          },
          metadata: {
            timestamp: new Date(),
            requestId: (req as any).requestId,
            version: config.app.version
          }
        };
        return res.status(400).json(response);
      }

      const response: APIResponse = {
        success: true,
        data: {
          valid: true,
          userId: result.userId,
          conversationId: result.conversationId,
          sessionId: result.sessionId,
          message: 'Token validated successfully'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      return res.json(response);

    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/v1/chat/tokens/initialize
 * Initialize chat token system for authenticated user
 */
router.post('/tokens/initialize',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const result = await chatTokenService.initializeForUser(userId);

      const response: APIResponse = {
        success: true,
        data: {
          spIdentifier: result.spIdentifier,
          currentToken: result.currentToken,
          chatUrl: await chatTokenService.getChatUrlForUser(userId),
          message: 'Chat token system initialized'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      return res.json(response);
    } catch (error) {
      logger.error('Failed to initialize chat tokens', { error, userId: req.user?.id });
      return next(error);
    }
  }
);

/**
 * POST /api/v1/chat/tokens/initialize-device
 * Initialize chat token system for device users (no authentication required)
 */
router.post('/tokens/initialize-device',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deviceUserId } = req.body;
      
      if (!deviceUserId || !deviceUserId.startsWith('device_')) {
        throw new ServiceTextProError('Valid device user ID required', 'INVALID_DEVICE_ID', 400);
      }

      const result = await chatTokenService.initializeForUser(deviceUserId);

      const response: APIResponse = {
        success: true,
        data: {
          spIdentifier: result.spIdentifier,
          currentToken: result.currentToken,
          chatUrl: await chatTokenService.getChatUrlForUser(deviceUserId),
          message: 'Chat token system initialized for device user'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      return res.json(response);
    } catch (error) {
      logger.error('Failed to initialize chat tokens for device user', { error, deviceUserId: req.body?.deviceUserId });
      return next(error);
    }
  }
);

/**
 * GET /api/v1/chat/tokens/current
 * Get current unused token for SMS templates
 */
router.get('/tokens/current',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const currentToken = await chatTokenService.getCurrentTokenForSMS(userId);
      const chatUrl = await chatTokenService.getChatUrlForUser(userId);

      const response: APIResponse = {
        success: true,
        data: {
          token: currentToken,
          chatUrl,
          message: 'Current token retrieved'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      return res.json(response);

    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/v1/chat/tokens/regenerate
 * Force generate a new token (invalidates current unused token)
 */
router.post('/tokens/regenerate',
  tokenRateLimit,
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const result = await chatTokenService.forceRegenerateToken(userId);

      const response: APIResponse = {
        success: true,
        data: {
          token: result.newToken,
          chatUrl: result.chatUrl,
          message: 'New token generated successfully'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      return res.json(response);

    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/v1/chat/tokens/regenerate-device
 * Force generate a new token for device users
 */
router.post('/tokens/regenerate-device',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deviceUserId } = req.body;
      
      if (!deviceUserId || !deviceUserId.startsWith('device_')) {
        throw new ServiceTextProError('Valid device user ID required', 'INVALID_DEVICE_ID', 400);
      }

      const result = await chatTokenService.forceRegenerateToken(deviceUserId);

      const response: APIResponse = {
        success: true,
        data: {
          token: result.newToken,
          chatUrl: result.chatUrl,
          message: 'New token generated for device user'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      return res.json(response);

    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/v1/chat/tokens/stats
 * Get token statistics for authenticated user
 */
router.get('/tokens/stats',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const stats = await chatTokenService.getTokenStats(userId);

      const response: APIResponse = {
        success: true,
        data: {
          stats,
          message: 'Token statistics retrieved'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      return res.json(response);

    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/v1/chat/tokens/cleanup
 * Clean up expired tokens (admin endpoint)
 */
router.post('/tokens/cleanup',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only allow admin users to run cleanup
      if (req.user?.role !== 'admin') {
        throw new ServiceTextProError('Admin access required', 'INSUFFICIENT_PERMISSIONS', 403);
      }

      const deletedCount = await chatTokenService.cleanupExpiredTokens();

      const response: APIResponse = {
        success: true,
        data: {
          deletedCount,
          message: `Cleaned up ${deletedCount} expired tokens`
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      return res.json(response);

    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/v1/chat/url
 * Get complete chat URL for authenticated user
 */
router.get('/url',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const baseUrl = req.query.baseUrl as string || process.env.FRONTEND_URL || 'https://maystorfix.com';
      const chatUrl = await chatTokenService.getChatUrlForUser(userId, baseUrl);

      const response: APIResponse = {
        success: true,
        data: {
          chatUrl,
          message: 'Chat URL generated'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      return res.json(response);

    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/v1/chat/sessions/:sessionId/validate
 * Validate a permanent chat session
 */
router.get('/sessions/:sessionId/validate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        throw new ServiceTextProError('Session ID is required', 'VALIDATION_ERROR', 400);
      }

      logger.info('Validating chat session', { sessionId });

      const result = await chatTokenService.validateSession(sessionId);

      if (!result.isValid) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'SESSION_INVALID',
            message: result.error || 'Session is invalid'
          },
          metadata: {
            timestamp: new Date(),
            requestId: (req as any).requestId,
            version: config.app.version
          }
        };
        return res.status(400).json(response);
      }

      const response: APIResponse = {
        success: true,
        data: {
          userId: result.userId,
          conversationId: result.conversationId,
          spIdentifier: result.spIdentifier,
          message: 'Session validated successfully'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      logger.info('Session validation successful', { 
        sessionId, 
        userId: result.userId,
        conversationId: result.conversationId 
      });

      return res.json(response);
    } catch (error) {
      logger.error('Failed to validate session', { sessionId: req.params.sessionId, error });
      return next(error);
    }
  }
);

export default router;
