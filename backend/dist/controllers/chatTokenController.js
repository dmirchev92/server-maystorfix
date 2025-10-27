"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("../middleware/auth");
const ChatTokenService_1 = require("../services/ChatTokenService");
const logger_1 = __importDefault(require("../utils/logger"));
const types_1 = require("../types");
const config_1 = __importDefault(require("../utils/config"));
const tokenRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
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
const router = (0, express_1.Router)();
const chatTokenService = new ChatTokenService_1.ChatTokenService();
router.get('/public/:spIdentifier/validate/:token', async (req, res, next) => {
    try {
        const { spIdentifier, token } = req.params;
        if (!spIdentifier || !token) {
            throw new types_1.ServiceTextProError('Missing required parameters', 'MISSING_PARAMETERS', 400);
        }
        logger_1.default.info('Validating chat token', {
            spIdentifier,
            token: token.substring(0, 4) + '****',
            ip: req.ip
        });
        const result = await chatTokenService.validateAndUseToken(spIdentifier, token);
        if (!result.isValid) {
            const response = {
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: result.error || 'Token validation failed'
                },
                metadata: {
                    timestamp: new Date(),
                    requestId: req.requestId,
                    version: config_1.default.app.version
                }
            };
            return res.status(400).json(response);
        }
        const response = {
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
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        return res.json(response);
    }
    catch (error) {
        return next(error);
    }
});
router.post('/tokens/initialize', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const result = await chatTokenService.initializeForUser(userId);
        const response = {
            success: true,
            data: {
                spIdentifier: result.spIdentifier,
                currentToken: result.currentToken,
                chatUrl: await chatTokenService.getChatUrlForUser(userId),
                message: 'Chat token system initialized'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        return res.json(response);
    }
    catch (error) {
        logger_1.default.error('Failed to initialize chat tokens', { error, userId: req.user?.id });
        return next(error);
    }
});
router.post('/tokens/initialize-device', async (req, res, next) => {
    try {
        const { deviceUserId } = req.body;
        if (!deviceUserId || !deviceUserId.startsWith('device_')) {
            throw new types_1.ServiceTextProError('Valid device user ID required', 'INVALID_DEVICE_ID', 400);
        }
        const result = await chatTokenService.initializeForUser(deviceUserId);
        const response = {
            success: true,
            data: {
                spIdentifier: result.spIdentifier,
                currentToken: result.currentToken,
                chatUrl: await chatTokenService.getChatUrlForUser(deviceUserId),
                message: 'Chat token system initialized for device user'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        return res.json(response);
    }
    catch (error) {
        logger_1.default.error('Failed to initialize chat tokens for device user', { error, deviceUserId: req.body?.deviceUserId });
        return next(error);
    }
});
router.get('/tokens/current', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const currentToken = await chatTokenService.getCurrentTokenForSMS(userId);
        const chatUrl = await chatTokenService.getChatUrlForUser(userId);
        const response = {
            success: true,
            data: {
                token: currentToken,
                chatUrl,
                message: 'Current token retrieved'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        return res.json(response);
    }
    catch (error) {
        return next(error);
    }
});
router.post('/tokens/regenerate', tokenRateLimit, auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const result = await chatTokenService.forceRegenerateToken(userId);
        const response = {
            success: true,
            data: {
                token: result.newToken,
                chatUrl: result.chatUrl,
                message: 'New token generated successfully'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        return res.json(response);
    }
    catch (error) {
        return next(error);
    }
});
router.post('/tokens/regenerate-device', async (req, res, next) => {
    try {
        const { deviceUserId } = req.body;
        if (!deviceUserId || !deviceUserId.startsWith('device_')) {
            throw new types_1.ServiceTextProError('Valid device user ID required', 'INVALID_DEVICE_ID', 400);
        }
        const result = await chatTokenService.forceRegenerateToken(deviceUserId);
        const response = {
            success: true,
            data: {
                token: result.newToken,
                chatUrl: result.chatUrl,
                message: 'New token generated for device user'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        return res.json(response);
    }
    catch (error) {
        return next(error);
    }
});
router.get('/tokens/stats', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const stats = await chatTokenService.getTokenStats(userId);
        const response = {
            success: true,
            data: {
                stats,
                message: 'Token statistics retrieved'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        return res.json(response);
    }
    catch (error) {
        return next(error);
    }
});
router.post('/tokens/cleanup', auth_1.authenticateToken, async (req, res, next) => {
    try {
        if (req.user?.role !== 'admin') {
            throw new types_1.ServiceTextProError('Admin access required', 'INSUFFICIENT_PERMISSIONS', 403);
        }
        const deletedCount = await chatTokenService.cleanupExpiredTokens();
        const response = {
            success: true,
            data: {
                deletedCount,
                message: `Cleaned up ${deletedCount} expired tokens`
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        return res.json(response);
    }
    catch (error) {
        return next(error);
    }
});
router.get('/url', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const baseUrl = req.query.baseUrl || process.env.FRONTEND_URL || 'https://maystorfix.com';
        const chatUrl = await chatTokenService.getChatUrlForUser(userId, baseUrl);
        const response = {
            success: true,
            data: {
                chatUrl,
                message: 'Chat URL generated'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        return res.json(response);
    }
    catch (error) {
        return next(error);
    }
});
router.get('/sessions/:sessionId/validate', async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            throw new types_1.ServiceTextProError('Session ID is required', 'VALIDATION_ERROR', 400);
        }
        logger_1.default.info('Validating chat session', { sessionId });
        const result = await chatTokenService.validateSession(sessionId);
        if (!result.isValid) {
            const response = {
                success: false,
                error: {
                    code: 'SESSION_INVALID',
                    message: result.error || 'Session is invalid'
                },
                metadata: {
                    timestamp: new Date(),
                    requestId: req.requestId,
                    version: config_1.default.app.version
                }
            };
            return res.status(400).json(response);
        }
        const response = {
            success: true,
            data: {
                userId: result.userId,
                conversationId: result.conversationId,
                spIdentifier: result.spIdentifier,
                message: 'Session validated successfully'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            }
        };
        logger_1.default.info('Session validation successful', {
            sessionId,
            userId: result.userId,
            conversationId: result.conversationId
        });
        return res.json(response);
    }
    catch (error) {
        logger_1.default.error('Failed to validate session', { sessionId: req.params.sessionId, error });
        return next(error);
    }
});
exports.default = router;
//# sourceMappingURL=chatTokenController.js.map