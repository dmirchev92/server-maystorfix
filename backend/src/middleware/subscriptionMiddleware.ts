/**
 * Subscription Middleware
 * Enforces tier-based access control for features
 */

import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/SubscriptionService';
import { SubscriptionTier, TierRequirementError, FeatureLimitError } from '../types/subscription';
import logger from '../utils/logger';

const subscriptionService = new SubscriptionService();

/**
 * Middleware to require a minimum subscription tier
 */
export const requireTier = (minimumTier: SubscriptionTier) => {
  return async (req: Request, res: Response, next: NextFunction) => {
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

      const userTier = await subscriptionService.getUserTier(userId);
      
      // Define tier hierarchy
      const tierHierarchy = {
        [SubscriptionTier.FREE]: 0,
        [SubscriptionTier.NORMAL]: 1,
        [SubscriptionTier.PRO]: 2
      };

      const userTierLevel = tierHierarchy[userTier];
      const requiredTierLevel = tierHierarchy[minimumTier];

      if (userTierLevel < requiredTierLevel) {
        logger.warn('Tier requirement not met', {
          userId,
          userTier,
          requiredTier: minimumTier,
          endpoint: req.path
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'TIER_REQUIREMENT_NOT_MET',
            message: `This feature requires ${minimumTier} tier or higher`,
            details: {
              currentTier: userTier,
              requiredTier: minimumTier
            }
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Tier check failed', { error });
      next(error);
    }
  };
};

/**
 * Middleware to check feature access and optionally increment usage
 */
export const checkFeatureAccess = (featureKey: string, increment: boolean = false) => {
  return async (req: Request, res: Response, next: NextFunction) => {
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

      const accessResult = await subscriptionService.checkFeatureAccess({
        user_id: userId,
        feature_key: featureKey,
        increment
      });

      if (!accessResult.allowed) {
        logger.warn('Feature access denied', {
          userId,
          feature: featureKey,
          reason: accessResult.message,
          usage: accessResult.current_usage,
          limit: accessResult.limit
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_ACCESS_DENIED',
            message: accessResult.message || 'Feature not available in your tier',
            details: {
              feature: featureKey,
              currentUsage: accessResult.current_usage,
              limit: accessResult.limit,
              tier: accessResult.tier
            }
          }
        });
      }

      // Attach access info to request for use in controller
      (req as any).featureAccess = accessResult;
      next();
    } catch (error) {
      logger.error('Feature access check failed', { error });
      next(error);
    }
  };
};

/**
 * Middleware to check if user can perform an action based on monthly limits
 */
export const checkMonthlyLimit = (limitKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
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

      const accessResult = await subscriptionService.checkFeatureAccess({
        user_id: userId,
        feature_key: limitKey,
        increment: true
      });

      if (!accessResult.allowed) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'MONTHLY_LIMIT_EXCEEDED',
            message: `You have reached your monthly limit for ${limitKey}`,
            details: {
              currentUsage: accessResult.current_usage,
              limit: accessResult.limit,
              tier: accessResult.tier,
              upgradeMessage: 'Upgrade your subscription to increase limits'
            }
          }
        });
      }

      (req as any).featureAccess = accessResult;
      next();
    } catch (error) {
      logger.error('Monthly limit check failed', { error });
      next(error);
    }
  };
};

/**
 * Middleware to attach user's tier information to request
 */
export const attachTierInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return next();
    }

    const userTier = await subscriptionService.getUserTier(userId);
    const tierData = await subscriptionService.getTierById(userTier);
    
    (req as any).userTier = userTier;
    (req as any).tierData = tierData;
    
    next();
  } catch (error) {
    logger.error('Failed to attach tier info', { error });
    // Don't fail the request, just continue without tier info
    next();
  }
};

/**
 * Helper to check if user is premium (NORMAL or PRO tier)
 */
export const isPremiumUser = async (userId: string): Promise<boolean> => {
  try {
    const tier = await subscriptionService.getUserTier(userId);
    return tier === SubscriptionTier.NORMAL || tier === SubscriptionTier.PRO;
  } catch (error) {
    logger.error('Failed to check premium status', { userId, error });
    return false;
  }
};

/**
 * Helper to check if user is PRO tier
 */
export const isProUser = async (userId: string): Promise<boolean> => {
  try {
    const tier = await subscriptionService.getUserTier(userId);
    return tier === SubscriptionTier.PRO;
  } catch (error) {
    logger.error('Failed to check PRO status', { userId, error });
    return false;
  }
};
