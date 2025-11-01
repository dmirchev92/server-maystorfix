/**
 * Trial Check Middleware
 * Blocks FREE tier users with expired trials from accessing protected routes
 */

import { Request, Response, NextFunction } from 'express';
import trialService from '../services/TrialService';
import logger from '../utils/logger';
import { AuthRequest } from '../types';

/**
 * Routes that are always accessible even with expired trial
 */
const ALLOWED_ROUTES = [
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/auth/refresh',
  '/api/v1/subscriptions/tiers',
  '/api/v1/subscriptions/upgrade',
  '/api/v1/subscriptions/my-subscription'
];

/**
 * Check if route is allowed during expired trial
 */
function isRouteAllowed(path: string): boolean {
  return ALLOWED_ROUTES.some(route => path.startsWith(route));
}

/**
 * Middleware to check trial status for FREE tier users
 */
export const checkTrialStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip if route is always allowed
    if (isRouteAllowed(req.path)) {
      return next();
    }

    // Skip if no user (will be caught by auth middleware)
    if (!req.user) {
      return next();
    }

    // Skip if not a tradesperson
    if (req.user.role !== 'tradesperson') {
      return next();
    }

    // Skip if not FREE tier
    if (req.user.subscription_tier_id !== 'free') {
      return next();
    }

    // Check trial status
    const trialStatus = await trialService.checkTrialStatus(req.user.id);

    // If trial expired, block access
    if (trialStatus.isExpired) {
      logger.warn('Trial expired - blocking access', {
        userId: req.user.id,
        email: req.user.email,
        path: req.path,
        reason: trialStatus.reason
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'TRIAL_EXPIRED',
          message: 'Your free trial has expired. Please upgrade to continue.',
          details: {
            casesUsed: trialStatus.casesUsed,
            reason: trialStatus.reason === 'cases_limit' 
              ? 'You have reached the maximum of 5 cases for the free trial.'
              : 'Your 14-day free trial period has ended.'
          }
        },
        metadata: {
          timestamp: new Date(),
          requiresUpgrade: true
        }
      });
      return;
    }

    // Add trial status to request for use in controllers
    (req as any).trialStatus = trialStatus;

    next();

  } catch (error) {
    logger.error('Error in trial check middleware', { error });
    // Don't block on error - let request through
    next();
  }
};

/**
 * Middleware to add trial info to responses
 */
export const addTrialInfo = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'tradesperson' || req.user.subscription_tier_id !== 'free') {
      return next();
    }

    const trialStatus = await trialService.checkTrialStatus(req.user.id);

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to add trial info
    res.json = function(body: any) {
      if (body && typeof body === 'object' && body.success) {
        body.trial = {
          isActive: trialStatus.isActive,
          casesRemaining: trialStatus.casesRemaining,
          daysRemaining: trialStatus.daysRemaining,
          expiresAt: trialStatus.expiresAt
        };
      }
      return originalJson(body);
    };

    next();

  } catch (error) {
    logger.error('Error adding trial info', { error });
    next();
  }
};
