"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const AuthService_1 = require("../services/AuthService");
const GDPRService_1 = require("../services/GDPRService");
const auth_1 = require("../middleware/auth");
const advancedSecuritySimple_1 = require("../middleware/advancedSecuritySimple");
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const router = (0, express_1.Router)();
const authService = new AuthService_1.AuthService();
const gdprService = new GDPRService_1.GDPRService();
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 500,
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
const passwordResetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: {
        success: false,
        error: {
            code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
            message: 'Too many password reset attempts, please try again later'
        }
    }
});
const validateRegistration = [
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must be at least 8 characters with uppercase, lowercase, number and special character'),
    (0, express_validator_1.body)('firstName')
        .trim()
        .isLength({ min: 1, max: 50 })
        .matches(/^[a-zA-ZА-Яа-я\s]+$/)
        .withMessage('First name must contain only letters (Bulgarian and Latin)'),
    (0, express_validator_1.body)('lastName')
        .trim()
        .isLength({ min: 1, max: 50 })
        .matches(/^[a-zA-ZА-Яа-я\s]+$/)
        .withMessage('Last name must contain only letters (Bulgarian and Latin)'),
    (0, express_validator_1.body)('phoneNumber')
        .matches(/^\+359[0-9]{8,9}$/)
        .withMessage('Valid Bulgarian phone number is required (+359xxxxxxxxx)'),
    (0, express_validator_1.body)('role')
        .isIn(Object.values(types_1.UserRole))
        .withMessage('Valid user role is required'),
    (0, express_validator_1.body)('gdprConsents')
        .isArray({ min: 1 })
        .withMessage('GDPR consents are required'),
    (0, express_validator_1.body)('gdprConsents.*')
        .isIn(Object.values(types_1.ConsentType))
        .withMessage('Invalid consent type'),
    (0, express_validator_1.body)('businessId')
        .optional()
        .isUUID()
        .withMessage('Valid business ID is required if provided')
];
const validateLogin = [
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required')
];
const validatePasswordResetRequest = [
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required')
];
const validatePasswordReset = [
    (0, express_validator_1.body)('token')
        .isUUID()
        .withMessage('Valid reset token is required'),
    (0, express_validator_1.body)('newPassword')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must be at least 8 characters with uppercase, lowercase, number and special character')
];
const validateConsentUpdate = [
    (0, express_validator_1.body)('consents')
        .isArray({ min: 1 })
        .withMessage('Consent updates are required'),
    (0, express_validator_1.body)('consents.*.consentType')
        .isIn(Object.values(types_1.ConsentType))
        .withMessage('Invalid consent type'),
    (0, express_validator_1.body)('consents.*.granted')
        .isBoolean()
        .withMessage('Consent granted status must be boolean'),
    (0, express_validator_1.body)('consents.*.reason')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Reason must be less than 500 characters')
];
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        const response = {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input data',
                details: errors.array()
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: '24 hours for security monitoring',
                rightsInformation: config_1.default.gdpr.urls.privacyPolicy
            }
        };
        return res.status(400).json(response);
    }
    return next();
};
router.post('/register', authLimiter, validateRegistration, handleValidationErrors, async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, phoneNumber, role, businessId, gdprConsents, serviceCategory, companyName, neighborhood } = req.body;
        console.log('🔍 Backend received registration data:', {
            email,
            role,
            serviceCategory,
            companyName,
            neighborhood,
            hasNeighborhood: !!neighborhood
        });
        if (config_1.default.gdpr.enabled && !gdprConsents.includes(types_1.ConsentType.ESSENTIAL_SERVICE)) {
            throw new types_1.GDPRComplianceError('Essential service consent is required');
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
        const response = {
            success: true,
            data: {
                user: result.user,
                tokens: result.tokens,
                message: 'Registration successful. Please verify your email address.'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.CONSENT,
                retentionPeriod: `${config_1.default.gdpr.dataRetention.businessDataMonths} months`,
                rightsInformation: config_1.default.gdpr.urls.privacyPolicy
            }
        };
        console.log('Registration response being sent:', JSON.stringify(response, null, 2));
        res.status(201).json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/login', advancedSecuritySimple_1.rateLimits.auth, advancedSecuritySimple_1.inputSanitization, advancedSecuritySimple_1.loginSecurity, validateLogin, handleValidationErrors, async (req, res, next) => {
    try {
        console.log('Login request body:', req.body);
        const { email, password } = req.body;
        const result = await authService.login({
            email,
            password,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        const response = {
            success: true,
            data: {
                user: result.user,
                tokens: result.tokens,
                message: 'Login successful'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: `${config_1.default.gdpr.dataRetention.businessDataMonths} months`,
                rightsInformation: config_1.default.gdpr.urls.privacyPolicy
            }
        };
        res.json(response);
    }
    catch (error) {
        if (error instanceof types_1.ServiceTextProError && error.code === 'INVALID_CREDENTIALS') {
            const response = {
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                    details: {
                        debugInfo: error.debugInfo,
                        securityInfo: error.securityInfo
                    }
                },
                metadata: {
                    timestamp: new Date(),
                    requestId: req.requestId,
                    version: config_1.default.app.version
                }
            };
            return res.status(error.statusCode).json(response);
        }
        return next(error);
    }
});
router.get('/me', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const user = await authService.findUserById(userId);
        if (!user) {
            throw new types_1.ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
        }
        const response = {
            success: true,
            data: {
                user: authService.sanitizeUser(user)
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/logout', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (userId) {
            logger_1.gdprLogger.logDataAccess(userId, 'user_logout', 'session_termination', req.ip);
        }
        const response = {
            success: true,
            data: {
                message: 'Logout successful'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/refresh', authLimiter, (0, express_validator_1.body)('refreshToken').notEmpty().withMessage('Refresh token is required'), handleValidationErrors, async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const tokens = await authService.refreshTokens(refreshToken);
        const response = {
            success: true,
            data: {
                tokens,
                message: 'Tokens refreshed successfully'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: 'Session duration only',
                rightsInformation: config_1.default.gdpr.urls.privacyPolicy
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/password-reset-request', passwordResetLimiter, validatePasswordResetRequest, handleValidationErrors, async (req, res, next) => {
    try {
        const { email } = req.body;
        await authService.requestPasswordReset({
            email,
            ipAddress: req.ip
        });
        const response = {
            success: true,
            data: {
                message: 'If the email exists, a password reset link has been sent.'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: '1 hour for reset token validity',
                rightsInformation: config_1.default.gdpr.urls.privacyPolicy
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/password-reset', passwordResetLimiter, validatePasswordReset, handleValidationErrors, async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        await authService.resetPassword({
            token,
            newPassword,
            ipAddress: req.ip
        });
        const response = {
            success: true,
            data: {
                message: 'Password reset successful. Please login with your new password.'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: 'Not applicable for password reset',
                rightsInformation: config_1.default.gdpr.urls.privacyPolicy
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.put('/consents', auth_1.authenticateToken, validateConsentUpdate, handleValidationErrors, async (req, res, next) => {
    try {
        const { consents } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        await authService.updateGDPRConsents(userId, consents, req.ip);
        const response = {
            success: true,
            data: {
                message: 'Consents updated successfully',
                updatedConsents: consents.length
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.CONSENT,
                retentionPeriod: 'Until consent is withdrawn',
                rightsInformation: config_1.default.gdpr.urls.privacyPolicy
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/logout', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        logger_1.gdprLogger.logDataAccess(userId, 'user_session', 'logout', req.ip);
        const response = {
            success: true,
            data: {
                message: 'Logout successful'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: 'Session terminated',
                rightsInformation: config_1.default.gdpr.urls.privacyPolicy
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=authController.js.map