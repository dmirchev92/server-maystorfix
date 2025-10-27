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
    .withMessage('Valid email is required'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number and special character'),
  
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-ZА-Яа-я\s]+$/)
    .withMessage('First name must contain only letters (Bulgarian and Latin)'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-ZА-Яа-я\s]+$/)
    .withMessage('Last name must contain only letters (Bulgarian and Latin)'),
  
  body('phoneNumber')
    .matches(/^\+359[0-9]{8,9}$/)
    .withMessage('Valid Bulgarian phone number is required (+359xxxxxxxxx)'),
  
  body('role')
    .isIn(Object.values(UserRole))
    .withMessage('Valid user role is required'),
  
  body('gdprConsents')
    .isArray({ min: 1 })
    .withMessage('GDPR consents are required'),
  
  body('gdprConsents.*')
    .isIn(Object.values(ConsentType))
    .withMessage('Invalid consent type'),
  
  body('businessId')
    .optional()
    .isUUID()
    .withMessage('Valid business ID is required if provided')
];

/**
 * Validation middleware for login
 */
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Validation middleware for password reset request
 */
const validatePasswordResetRequest = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
];

/**
 * Validation middleware for password reset
 */
const validatePasswordReset = [
  body('token')
    .isUUID()
    .withMessage('Valid reset token is required'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number and special character')
];

/**
 * Validation middleware for consent updates
 */
const validateConsentUpdate = [
  body('consents')
    .isArray({ min: 1 })
    .withMessage('Consent updates are required'),
  
  body('consents.*.consentType')
    .isIn(Object.values(ConsentType))
    .withMessage('Invalid consent type'),
  
  body('consents.*.granted')
    .isBoolean()
    .withMessage('Consent granted status must be boolean'),
  
  body('consents.*.reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
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
        neighborhood
      } = req.body;

      console.log('🔍 Backend received registration data:', {
        email,
        role,
        serviceCategory,
        companyName,
        neighborhood,
        hasNeighborhood: !!neighborhood
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
        neighborhood,
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
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
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

export default router;
