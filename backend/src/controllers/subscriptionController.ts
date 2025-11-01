/**
 * Subscription Controller
 * Handles subscription tier management endpoints
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { SubscriptionService } from '../services/SubscriptionService';
import { authenticateToken } from '../middleware/auth';
import { SubscriptionTier } from '../types/subscription';
import logger from '../utils/logger';

const router = Router();
const subscriptionService = new SubscriptionService();

/**
 * GET /api/v1/subscriptions/tiers
 * Get all available subscription tiers
 */
router.get('/tiers', async (req: Request, res: Response) => {
  try {
    const tiers = await subscriptionService.getAllTiers();
    
    res.json({
      success: true,
      data: {
        tiers
      },
      metadata: {
        timestamp: new Date(),
        count: tiers.length
      }
    });
  } catch (error) {
    logger.error('Failed to fetch tiers', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_TIERS_ERROR',
        message: 'Failed to fetch subscription tiers'
      }
    });
  }
});

/**
 * GET /api/v1/subscriptions/tiers/comparison
 * Get tier comparison for display
 */
router.get('/tiers/comparison', async (req: Request, res: Response) => {
  try {
    const comparison = await subscriptionService.getTierComparison();
    
    res.json({
      success: true,
      data: {
        comparison
      },
      metadata: {
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to fetch tier comparison', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_COMPARISON_ERROR',
        message: 'Failed to fetch tier comparison'
      }
    });
  }
});

/**
 * GET /api/v1/subscriptions/my-subscription
 * Get current user's subscription
 */
router.get('/my-subscription', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const subscription = await subscriptionService.getUserSubscription(userId);
    const tierName = await subscriptionService.getUserTier(userId);
    const tierData = await subscriptionService.getTierById(tierName);
    
    res.json({
      success: true,
      data: {
        subscription,
        currentTier: tierData,
        tierName
      },
      metadata: {
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to fetch user subscription', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SUBSCRIPTION_ERROR',
        message: 'Failed to fetch subscription'
      }
    });
  }
});

/**
 * POST /api/v1/subscriptions/upgrade
 * Upgrade or change subscription tier
 */
router.post(
  '/upgrade',
  authenticateToken,
  [
    body('tier_id')
      .isIn([SubscriptionTier.FREE, SubscriptionTier.NORMAL, SubscriptionTier.PRO])
      .withMessage('Invalid tier ID'),
    body('payment_method')
      .optional()
      .isString()
      .withMessage('Payment method must be a string'),
    body('auto_renew')
      .optional()
      .isBoolean()
      .withMessage('Auto renew must be boolean')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const { tier_id, payment_method, auto_renew } = req.body;

      const subscription = await subscriptionService.upgradeSubscription({
        user_id: userId,
        target_tier_id: tier_id,
        payment_method,
        auto_renew
      });

      logger.info('Subscription upgraded', { userId, tierId: tier_id });

      res.json({
        success: true,
        data: {
          subscription,
          message: 'Subscription upgraded successfully'
        },
        metadata: {
          timestamp: new Date()
        }
      });
    } catch (error: any) {
      logger.error('Failed to upgrade subscription', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'UPGRADE_ERROR',
          message: error.message || 'Failed to upgrade subscription'
        }
      });
    }
  }
);

/**
 * POST /api/v1/subscriptions/cancel
 * Cancel subscription
 */
router.post(
  '/cancel',
  authenticateToken,
  [
    body('subscription_id')
      .isString()
      .notEmpty()
      .withMessage('Subscription ID is required'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    body('immediate')
      .optional()
      .isBoolean()
      .withMessage('Immediate must be boolean')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const { subscription_id, reason, immediate } = req.body;

      await subscriptionService.cancelSubscription({
        user_id: userId,
        subscription_id,
        reason,
        immediate
      });

      logger.info('Subscription cancelled', { userId, subscriptionId: subscription_id });

      res.json({
        success: true,
        data: {
          message: immediate 
            ? 'Subscription cancelled immediately' 
            : 'Subscription will be cancelled at the end of the billing period'
        },
        metadata: {
          timestamp: new Date()
        }
      });
    } catch (error: any) {
      logger.error('Failed to cancel subscription', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'CANCEL_ERROR',
          message: error.message || 'Failed to cancel subscription'
        }
      });
    }
  }
);

/**
 * GET /api/v1/subscriptions/feature-access/:feature
 * Check if user has access to a specific feature
 */
router.get('/feature-access/:feature', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { feature } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const accessResult = await subscriptionService.checkFeatureAccess({
      user_id: userId,
      feature_key: feature,
      increment: false
    });

    res.json({
      success: true,
      data: accessResult,
      metadata: {
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to check feature access', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'FEATURE_CHECK_ERROR',
        message: 'Failed to check feature access'
      }
    });
  }
});

export default router;
