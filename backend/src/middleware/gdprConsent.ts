// GDPR Consent Middleware
// Protects API routes by checking user consent before allowing access

import { Request, Response, NextFunction } from 'express';
import { ConsentType, ConsentCheckResult, DataProcessingBasis } from '../types';
import { GDPRService } from '../services/GDPRService';
import { getConsentDenialMessage, getConsentManagementUrl } from '../utils/consentHelpers';
import logger from '../utils/logger';

// Extend Express Request to include consent check results
declare global {
  namespace Express {
    interface Request {
      consentCheck?: {
        checked: boolean;
        results: Record<ConsentType, ConsentCheckResult>;
        allGranted: boolean;
        missingConsents: ConsentType[];
      };
    }
  }
}

// Initialize GDPR service (singleton)
const gdprService = GDPRService.getInstance();

/**
 * Require specific consent(s) to access route
 * Blocks request with 403 if any required consent is missing
 *
 * @param requiredConsents - Array of consent types required for this route
 * @returns Express middleware function
 *
 * @example
 * router.post('/send-sms',
 *   authenticateToken,
 *   requireConsent([ConsentType.THIRD_PARTY_INTEGRATIONS]),
 *   handler
 * );
 */
export const requireConsent = (requiredConsents: ConsentType[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Ensure user is authenticated (should be set by auth middleware)
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required to check consents'
          }
        });
        return;
      }

      const userId = req.user.id;

      // 2. Check all required consents
      logger.info('Checking consents', { userId, requiredConsents });
      const results = await gdprService.checkUserConsents(userId, requiredConsents);

      // 3. Find missing consents
      const missingConsents = requiredConsents.filter(
        (consentType) => !results[consentType].allowed
      );

      // 4. Block request if any required consent is missing
      if (missingConsents.length > 0) {
        logger.warn('Consent required - blocking request', {
          userId,
          path: req.path,
          method: req.method,
          requiredConsents,
          missingConsents
        });

        // Log consent violation for audit trail
        await logConsentViolation(userId, requiredConsents, missingConsents, req);

        res.status(403).json({
          success: false,
          error: {
            code: 'CONSENT_REQUIRED',
            message: getConsentDenialMessage(missingConsents[0]), // Bulgarian message
            messageEN: 'User consent required for this action',
            details: {
              requiredConsents,
              missingConsents,
              consentManagementUrl: getConsentManagementUrl(),
              settingsDeepLink: 'app://settings/privacy'
            }
          },
          gdpr: {
            dataProcessingBasis: DataProcessingBasis.CONSENT,
            retentionPeriod: 'Until consent is withdrawn',
            rightsInformation: 'You can manage your consent preferences in app settings'
          }
        });
        return;
      }

      // 5. Attach consent check results to request for later use
      req.consentCheck = {
        checked: true,
        results,
        allGranted: true,
        missingConsents: []
      };

      // 6. Log successful consent check
      logger.info('Consent check passed', { userId, requiredConsents });

      // 7. Proceed to next middleware/handler
      next();
    } catch (error) {
      logger.error('Consent middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        path: req.path
      });

      // Fail-safe: deny access if consent check fails
      res.status(500).json({
        success: false,
        error: {
          code: 'CONSENT_CHECK_ERROR',
          message: 'Failed to verify consent. Please try again.',
          details: {
            consentManagementUrl: getConsentManagementUrl()
          }
        }
      });
    }
  };
};

/**
 * Check consent but don't block (attach results to request only)
 * Useful for optional features that should gracefully degrade
 *
 * @param consentTypes - Array of consent types to check
 * @returns Express middleware function
 */
export const checkConsent = (consentTypes: ConsentType[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        // No user, skip consent check
        req.consentCheck = {
          checked: false,
          results: {} as any,
          allGranted: false,
          missingConsents: consentTypes
        };
        next();
        return;
      }

      const userId = req.user.id;
      const results = await gdprService.checkUserConsents(userId, consentTypes);
      const missingConsents = consentTypes.filter((type) => !results[type].allowed);

      req.consentCheck = {
        checked: true,
        results,
        allGranted: missingConsents.length === 0,
        missingConsents
      };

      // Always proceed (non-blocking)
      next();
    } catch (error) {
      logger.error('Non-blocking consent check error', { error, userId: req.user?.id });

      req.consentCheck = {
        checked: false,
        results: {} as any,
        allGranted: false,
        missingConsents: consentTypes
      };

      next();
    }
  };
};

/**
 * Log consent violation for audit trail
 */
async function logConsentViolation(
  userId: string,
  requiredConsents: ConsentType[],
  missingConsents: ConsentType[],
  req: Request
): Promise<void> {
  try {
    logger.warn('GDPR Consent Violation', {
      userId,
      requiredConsents,
      missingConsents,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to log consent violation', { error });
  }
}

// Convenience middleware for common consent requirements

/**
 * Require data storage/sharing consent
 * Use for saving conversations, chat messages
 */
export const requireDataStorageConsent = requireConsent([ConsentType.DATA_SHARING]);

/**
 * Require essential service consent
 * Generally should always be granted, but useful for critical operations
 */
export const requireEssentialConsent = requireConsent([ConsentType.ESSENTIAL_SERVICE]);
