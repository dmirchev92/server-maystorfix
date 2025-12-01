// GDPR-compliant Authentication Controller
// Handles user registration, login, password reset, and consent management

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

import { AuthService } from '../services/AuthService';
import { GDPRService } from '../services/GDPRService';
import { authenticateToken } from '../middleware/auth';
import { loginSecurity, rateLimits, inputSanitization } from '../middleware/advancedSecuritySimple';
import config from '../utils/config';
import logger, { gdprLogger } from '../utils/logger';
import {
  UserRole,
  ConsentType,
  DataProcessingBasis,
  ServiceTextProError,
  GDPRComplianceError,
  APIResponse
} from '../types';

const router = Router();
const authService = new AuthService();
const gdprService = new GDPRService();

// Rate limiting for authentication endpoints (relaxed for development)
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // 500 attempts per window (very generous for development)
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset attempts per hour
  message: {
    success: false,
    error: {
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts, please try again later'
    }
  }
});

/**
 * Validation middleware for registration
 */
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Моля въведете валиден имейл адрес'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Паролата трябва да съдържа поне 8 символа, главна буква, малка буква, цифра и специален символ'),
  
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-ZА-Яа-я\s]+$/)
    .withMessage('Името трябва да съдържа само букви (български или латински)'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-ZА-Яа-я\s]+$/)
    .withMessage('Фамилията трябва да съдържа само букви (български или латински)'),
  
  body('phoneNumber')
    .custom((value) => {
      // Accept +359 format or 0 format for Bulgarian numbers
      const plusFormat = /^\+359[0-9]{8,9}$/;
      const zeroFormat = /^0[0-9]{8,9}$/;
      if (!plusFormat.test(value) && !zeroFormat.test(value)) {
        throw new Error('Телефонният номер трябва да започва с +359 или 0 (например: +359888123456 или 0888123456)');
      }
      return true;
    }),
  
  body('role')
    .isIn(Object.values(UserRole))
    .withMessage('Моля изберете валидна роля'),
  
  body('gdprConsents')
    .isArray({ min: 1 })
    .withMessage('Трябва да приемете условията за поверителност'),
  
  body('gdprConsents.*')
    .isIn(Object.values(ConsentType))
    .withMessage('Невалиден тип съгласие'),
  
  body('businessId')
    .optional()
    .isUUID()
    .withMessage('Невалиден идентификатор на бизнес'),
  
  body('subscription_tier_id')
    .optional()
    .isIn(['free', 'normal', 'pro'])
    .withMessage('Моля изберете валиден абонаментен план (безплатен, нормален или професионален)')
];

/**
 * Validation middleware for login
 */
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Моля въведете валиден имейл адрес'),
  
  body('password')
    .notEmpty()
    .withMessage('Моля въведете парола')
];

/**
 * Validation middleware for password reset request
 */
const validatePasswordResetRequest = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Моля въведете валиден имейл адрес')
];

/**
 * Validation middleware for password reset
 */
const validatePasswordReset = [
  body('token')
    .isUUID()
    .withMessage('Невалиден токен за възстановяване'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Паролата трябва да съдържа поне 8 символа, главна буква, малка буква, цифра и специален символ')
];

/**
 * Validation middleware for consent updates
 */
const validateConsentUpdate = [
  body('consents')
    .isArray({ min: 1 })
    .withMessage('Трябва да предоставите поне едно съгласие'),
  
  body('consents.*.consentType')
    .isIn(Object.values(ConsentType))
    .withMessage('Невалиден тип съгласие'),
  
  body('consents.*.granted')
    .isBoolean()
    .withMessage('Статусът на съгласието трябва да бъде да/не'),
  
  body('consents.*.reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Причината трябва да бъде под 500 символа')
];

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    const response: APIResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array()
      },
      gdpr: {
        dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
        retentionPeriod: '24 hours for security monitoring',
        rightsInformation: config.gdpr.urls.privacyPolicy
      }
    };
    
    return res.status(400).json(response);
  }
  return next();
};

/**
 * POST /api/v1/auth/register
 * Register a new user with GDPR compliance
 */
router.post('/register', 
  authLimiter,
  validateRegistration,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        email, 
        password, 
        firstName, 
        lastName, 
        phoneNumber, 
        role, 
        businessId, 
        gdprConsents,
        serviceCategory,
        companyName,
        city,
        neighborhood,
        address,
        subscription_tier_id
      } = req.body;

      console.log('🔍 Backend received registration data:', {
        email,
        role,
        serviceCategory,
        companyName,
        city,
        neighborhood,
        address,
        subscription_tier_id,
        hasNeighborhood: !!neighborhood,
        hasCity: !!city
      });

      // Validate GDPR compliance
      if (config.gdpr.enabled && !gdprConsents.includes(ConsentType.ESSENTIAL_SERVICE)) {
        throw new GDPRComplianceError('Essential service consent is required');
      }

      const result = await authService.register({
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        role,
        businessId,
        gdprConsents,
        serviceCategory,
        companyName,
        city,
        neighborhood,
        address,
        subscription_tier_id: subscription_tier_id || 'free',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const response: APIResponse = {
        success: true,
        data: {
          user: result.user,
          tokens: result.tokens,
          message: 'Registration successful. Please verify your email address.'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.CONSENT,
          retentionPeriod: `${config.gdpr.dataRetention.businessDataMonths} months`,
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      };

      console.log('Registration response being sent:', JSON.stringify(response, null, 2));
      res.status(201).json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Authenticate user with GDPR audit logging
 */
router.post('/login',
  rateLimits.auth,           // 🔒 Enhanced rate limiting
  inputSanitization,         // 🔒 Input sanitization
  loginSecurity,             // 🔒 Brute force protection
  validateLogin,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('Login request body:', req.body);
      const { email, password } = req.body;

      const result = await authService.login({
        email,
        password,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const response: APIResponse = {
        success: true,
        data: {
          user: result.user,
          tokens: result.tokens,
          message: 'Login successful'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: `${config.gdpr.dataRetention.businessDataMonths} months`,
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      };

      res.json(response);

    } catch (error) {
      // Enhanced error handling for login attempts with debug info
      if (error instanceof ServiceTextProError && error.code === 'INVALID_CREDENTIALS') {
        const response: APIResponse = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: {
              debugInfo: (error as any).debugInfo, // Include debug info for development
              securityInfo: (error as any).securityInfo // Include attempt counts
            }
          },
          metadata: {
            timestamp: new Date(),
            requestId: (req as any).requestId,
            version: config.app.version
          }
        };
        
        return res.status(error.statusCode).json(response);
      }
      
      return next(error);
    }
  }
);

/**
 * GET /api/v1/auth/me
 * Get current user profile
 */
router.get('/me',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const user = await authService.findUserById(userId);
      if (!user) {
        throw new ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
      }

      const response: APIResponse = {
        success: true,
        data: {
          user: authService.sanitizeUser(user)
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Log logout event for GDPR compliance
      const userId = req.user?.id;
      if (userId) {
        gdprLogger.logDataAccess(
          userId,
          'user_logout',
          'session_termination',
          req.ip
        );
      }

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Logout successful'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Refresh authentication tokens
 */
router.post('/refresh',
  authLimiter,
  body('refreshToken').notEmpty().withMessage('Токенът за опресняване е задължителен'),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      const tokens = await authService.refreshTokens(refreshToken);

      const response: APIResponse = {
        success: true,
        data: {
          tokens,
          message: 'Tokens refreshed successfully'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Session duration only',
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/password-reset-request
 * Request password reset with GDPR compliance
 */
router.post('/password-reset-request',
  passwordResetLimiter,
  validatePasswordResetRequest,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      await authService.requestPasswordReset({
        email,
        ipAddress: req.ip
      });

      // Always return success for security (don't reveal if email exists)
      const response: APIResponse = {
        success: true,
        data: {
          message: 'If the email exists, a password reset link has been sent.'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: '1 hour for reset token validity',
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/password-reset
 * Reset password using token
 */
router.post('/password-reset',
  passwordResetLimiter,
  validatePasswordReset,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body;

      await authService.resetPassword({
        token,
        newPassword,
        ipAddress: req.ip
      });

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Password reset successful. Please login with your new password.'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Not applicable for password reset',
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/auth/consents
 * Update user GDPR consents (requires authentication)
 */
router.put('/consents',
  authenticateToken,
  validateConsentUpdate,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { consents } = req.body;
      const userId = req.user?.id; // From authentication middleware

      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      await authService.updateGDPRConsents(
        userId,
        consents,
        req.ip
      );

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Consents updated successfully',
          updatedConsents: consents.length
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.CONSENT,
          retentionPeriod: 'Until consent is withdrawn',
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);



/**
 * POST /api/v1/auth/logout
 * Logout user (invalidate tokens)
 */
router.post('/logout',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      // TODO: Implement token invalidation (add to blacklist in Redis)

      // Log logout for GDPR audit
      gdprLogger.logDataAccess(
        userId,
        'user_session',
        'logout',
        req.ip
      );

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Logout successful'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Session terminated',
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/auth/verify-email
 * Verify email address using token
 */
router.get('/verify-email',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        throw new ServiceTextProError('Verification token is required', 'INVALID_TOKEN', 400);
      }

      const result = await authService.verifyEmail(token);

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Email verified successfully',
          user: result.user
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.CONSENT,
          retentionPeriod: `${config.gdpr.dataRetention.businessDataMonths} months`,
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification',
  authLimiter,
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Моля въведете валиден имейл адрес'),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      await authService.resendVerificationEmail(email, req.ip);

      // Always return success for security (don't reveal if email exists)
      const response: APIResponse = {
        success: true,
        data: {
          message: 'Ако имейлът съществува и не е потвърден, е изпратена линк за потвърждение.'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.CONSENT,
          retentionPeriod: '24 hours for verification token validity',
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      };

      res.json(response);

    } catch (error) {
      // Handle specific error for already verified email
      if (error instanceof ServiceTextProError && error.code === 'EMAIL_ALREADY_VERIFIED') {
        const response: APIResponse = {
          success: false,
          error: {
            code: error.code,
            message: 'Email is already verified'
          },
          metadata: {
            timestamp: new Date(),
            requestId: (req as any).requestId,
            version: config.app.version
          }
        };
        return res.status(400).json(response);
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/test-email
 * Test email configuration (admin only)
 */
router.post('/test-email',
  authenticateToken,
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Моля въведете валиден имейл адрес'),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only allow admins to test email
      if (req.user?.role !== 'admin') {
        throw new ServiceTextProError('Admin access required', 'FORBIDDEN', 403);
      }

      const { email } = req.body;
      
      // Import EmailService dynamically to avoid circular dependency
      const EmailService = require('../services/EmailService').default;
      const success = await EmailService.sendTestEmail(email);

      const response: APIResponse = {
        success,
        data: {
          message: success ? 'Test email sent successfully' : 'Failed to send test email',
          configured: EmailService.isServiceConfigured()
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/auth/delete-account
 * Delete user account and all associated data (GDPR compliance)
 * Requires password confirmation
 */
router.delete('/delete-account',
  authenticateToken,
  body('password')
    .notEmpty()
    .withMessage('Password is required for account deletion'),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const { password } = req.body;
      
      if (!userId) {
        throw new ServiceTextProError('User not authenticated', 'UNAUTHORIZED', 401);
      }

      // Verify password before deletion
      const isValidPassword = await authService.verifyPassword(userId, password);
      if (!isValidPassword) {
        throw new ServiceTextProError('Невалидна парола', 'INVALID_PASSWORD', 400);
      }

      logger.info('User account deletion requested', { userId });

      // Get database instance
      const { DatabaseFactory } = require('../models/DatabaseFactory');
      const database = DatabaseFactory.getDatabase();

      // Delete all related data in proper order (FK constraints)
      const tablesToClear = [
        // Chat related
        'marketplace_chat_receipts',
        'marketplace_chat_attachments', 
        'marketplace_chat_messages',
        'marketplace_chat_participants',
        'marketplace_conversations',
        'chat_sessions',
        'chat_tokens',
        // Cases and bids
        'sp_case_bids',
        'sp_premium_bids',
        'sp_case_access',
        'case_income',
        'case_screenshots',
        'case_reviews',
        'case_assignments',
        'case_queue',
        'marketplace_case_declines',
        'marketplace_service_cases',
        'marketplace_inquiries',
        // Provider related
        'provider_reviews',
        'provider_certificates',
        'provider_gallery',
        'provider_service_categories',
        'provider_services',
        'provider_location_schedule',
        'service_provider_profiles',
        'service_provider_identifiers',
        // Subscription and points
        'sp_points_transactions',
        'sp_subscription_history',
        'sp_subscriptions',
        'sp_feature_usage',
        'sp_sms_packages',
        // Referrals
        'referral_sms_claim_tokens',
        'referral_rewards',
        'referral_clicks',
        'sp_referrals',
        'sp_referral_codes',
        // Notifications
        'notifications',
        'notification_preferences',
        'device_tokens',
        // SMS and calls
        'sms_settings',
        'sms_verification_codes',
        'missed_calls',
        // Auth and GDPR
        'gdpr_consents',
        'gdpr_audit_log',
        'email_verification_tokens',
        'password_reset_tokens',
        'email_logs',
        'sp_tracking_sessions',
      ];

      // Delete from each table where user_id matches
      for (const table of tablesToClear) {
        try {
          // Different tables have different column names for user reference
          const userColumns = ['user_id', 'provider_id', 'customer_id', 'sender_id', 'recipient_id'];
          for (const col of userColumns) {
            try {
              await database.query(`DELETE FROM ${table} WHERE ${col} = $1`, [userId]);
            } catch (e) {
              // Column might not exist in this table, ignore
            }
          }
        } catch (error) {
          // Table might not exist, continue
          logger.debug(`Could not delete from ${table}`, { error });
        }
      }

      // Delete the user record itself
      await database.query('DELETE FROM users WHERE id = $1', [userId]);

      // Delete user's upload folder if exists
      const fs = require('fs');
      const path = require('path');
      const userUploadPath = path.join(__dirname, '../../uploads', userId);
      if (fs.existsSync(userUploadPath)) {
        fs.rmSync(userUploadPath, { recursive: true, force: true });
      }

      // Log GDPR deletion event
      logger.info('User account deleted (GDPR right to erasure)', { userId });

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Акаунтът ви беше изтрит успешно. Всички данни бяха премахнати.'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

export default router;
