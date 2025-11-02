/**
 * SMS Verification Controller
 * Handles phone verification during registration
 */

import { Router, Request, Response, NextFunction } from 'express';
import smsVerificationService from '../services/SMSVerificationService';
import logger from '../utils/logger';
import { APIResponse, ServiceTextProError } from '../types';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for verification endpoints
const verificationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Твърде много опити. Моля, изчакайте 15 минути.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * POST /api/v1/verification/send-code
 * Send SMS verification code to phone number
 */
router.post('/send-code',
  verificationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        throw new ServiceTextProError(
          'Телефонният номер е задължителен',
          'PHONE_REQUIRED',
          400
        );
      }

      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

      logger.info('📱 Verification code requested', {
        phone: phoneNumber.substring(0, 4) + '***',
        ip: ipAddress
      });

      const result = await smsVerificationService.sendVerificationCode(
        phoneNumber,
        ipAddress
      );

      if (result.success) {
        const response: APIResponse = {
          success: true,
          data: {
            message: result.message,
            // Include code in development for testing
            ...(process.env.NODE_ENV === 'development' && result.code ? { code: result.code } : {})
          },
          metadata: {
            timestamp: new Date(),
            requestId: 'unknown',
            version: '1.0.0'
          }
        };
        res.json(response);
      } else {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'SEND_CODE_FAILED',
            message: result.message
          },
          metadata: {
            timestamp: new Date(),
            requestId: 'unknown',
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
      }

    } catch (error) {
      logger.error('❌ Error sending verification code:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/verification/verify-code
 * Verify SMS code
 */
router.post('/verify-code',
  verificationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber, code } = req.body;

      if (!phoneNumber || !code) {
        throw new ServiceTextProError(
          'Телефонен номер и код са задължителни',
          'PHONE_AND_CODE_REQUIRED',
          400
        );
      }

      logger.info('🔍 Verifying code', {
        phone: phoneNumber.substring(0, 4) + '***'
      });

      const result = await smsVerificationService.verifyCode(phoneNumber, code);

      if (result.success) {
        const response: APIResponse = {
          success: true,
          data: {
            message: result.message,
            verified: true
          },
          metadata: {
            timestamp: new Date(),
            requestId: 'unknown',
            version: '1.0.0'
          }
        };
        res.json(response);
      } else {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: result.message
          },
          metadata: {
            timestamp: new Date(),
            requestId: 'unknown',
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
      }

    } catch (error) {
      logger.error('❌ Error verifying code:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/verification/check/:phoneNumber
 * Check if phone number is verified
 */
router.get('/check/:phoneNumber',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        throw new ServiceTextProError(
          'Телефонният номер е задължителен',
          'PHONE_REQUIRED',
          400
        );
      }

      const isVerified = await smsVerificationService.isPhoneVerified(phoneNumber);

      const response: APIResponse = {
        success: true,
        data: {
          phoneNumber,
          verified: isVerified
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'unknown',
          version: '1.0.0'
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('❌ Error checking verification:', error);
      next(error);
    }
  }
);

export default router;
