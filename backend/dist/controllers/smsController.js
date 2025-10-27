"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const ChatTokenService_1 = require("../services/ChatTokenService");
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const logger_1 = __importDefault(require("../utils/logger"));
const types_1 = require("../types");
const config_1 = __importDefault(require("../utils/config"));
const server_1 = require("../server");
const router = (0, express_1.Router)();
const chatTokenService = new ChatTokenService_1.ChatTokenService();
const db = DatabaseFactory_1.DatabaseFactory.getDatabase();
router.get('/config', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const stats = {
            todayCount: 0,
            thisHourCount: 0,
            totalCount: 0
        };
        let currentChatUrl = '';
        let previewMessage = '';
        try {
            const currentToken = await chatTokenService.getCurrentTokenForSMS(userId);
            currentChatUrl = await chatTokenService.getChatUrlForUser(userId);
            const defaultMessage = 'Зает съм, ще върна обаждане след няколко минути.\n\nЗапочнете чат тук:\n[chat_link]\n\n';
        }
        catch (error) {
            logger_1.default.warn('Could not get current chat URL for SMS preview', { userId, error });
            previewMessage = 'Зает съм, ще върна обаждане след няколко минути.\n\nЗапочнете чат тук:\nГенериране на връзка...\n\n';
        }
        const smsSettings = await db.getSMSSettings(userId);
        const userChatLinks = {};
        try {
            const currentToken = await chatTokenService.getCurrentTokenForSMS(userId);
            const chatUrl = await chatTokenService.getChatUrlForUser(userId);
            if (currentToken && chatUrl) {
                const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
                userChatLinks[userId] = {
                    link: chatUrl,
                    token: currentToken,
                    expiresAt: expiresAt
                };
                logger_1.default.info('Added chat link to SMS config', { userId, chatUrl });
            }
        }
        catch (error) {
            logger_1.default.warn('Could not get chat link for SMS config', { userId, error });
        }
        const smsConfig = {
            isEnabled: smsSettings?.isEnabled || false,
            message: smsSettings?.message || '',
            sentCount: smsSettings?.sentCount || 0,
            lastSentTime: smsSettings?.lastSentTime || null,
            filterKnownContacts: smsSettings?.filterKnownContacts || false,
            processedCalls: smsSettings?.sentCallIds?.length || 0,
            userChatLinks: userChatLinks
        };
        const response = {
            success: true,
            data: {
                config: smsConfig,
                stats: stats,
                preview: previewMessage,
                currentChatUrl: currentChatUrl
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
        logger_1.default.error('Error getting SMS config:', error);
        next(error);
    }
});
router.put('/config', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const { isEnabled, message, filterKnownContacts } = req.body;
        if (message && typeof message === 'string') {
            if (message.length > 500) {
                throw new types_1.ServiceTextProError('Message too long (max 500 characters)', 'MESSAGE_TOO_LONG', 400);
            }
            if (!message.includes('[chat_link]')) {
                throw new types_1.ServiceTextProError('Message must contain [chat_link] placeholder', 'MISSING_CHAT_LINK', 400);
            }
        }
        const updates = {};
        if (isEnabled !== undefined)
            updates.isEnabled = isEnabled;
        if (message !== undefined)
            updates.message = message;
        if (filterKnownContacts !== undefined)
            updates.filterKnownContacts = filterKnownContacts;
        await db.updateSMSSettings(userId, updates);
        logger_1.default.info('SMS config updated in database', {
            userId,
            updates: { isEnabled, messageLength: message?.length, filterKnownContacts }
        });
        try {
            const io = (0, server_1.getIO)();
            io.to(`user:${userId}`).emit('sms-config-updated', {
                isEnabled: updates.isEnabled,
                message: updates.message,
                filterKnownContacts: updates.filterKnownContacts
            });
            logger_1.default.info('Socket.IO event emitted for SMS config update', { userId });
        }
        catch (socketError) {
            logger_1.default.warn('Could not emit Socket.IO event for SMS config', { userId, error: socketError });
        }
        const response = {
            success: true,
            data: {
                message: 'SMS configuration updated successfully'
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
        logger_1.default.error('Error updating SMS config:', error);
        next(error);
    }
});
router.delete('/history/clear', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        await db.clearSMSHistory(userId);
        logger_1.default.info('SMS history cleared from database', { userId });
        const response = {
            success: true,
            data: {
                message: 'SMS history cleared successfully'
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
        logger_1.default.error('Error clearing SMS history:', error);
    }
});
router.get('/stats', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const stats = {
            todayCount: 0,
            thisHourCount: 0,
            totalCount: 0
        };
        const canSend = { canSend: true, reason: null };
        const response = {
            success: true,
            data: {
                stats: stats,
                limits: {
                    dailyLimit: config_1.default.security.sms.dailyLimit,
                    hourlyThreshold: config_1.default.security.sms.suspiciousThreshold,
                    canSend: canSend.canSend,
                    reason: canSend.reason
                }
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
        logger_1.default.error('Error getting SMS stats:', error);
        next(error);
    }
});
router.post('/test-security', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const { phoneNumber, message } = req.body;
        if (!phoneNumber || !message) {
            throw new types_1.ServiceTextProError('Phone number and message required', 'MISSING_PARAMETERS', 400);
        }
        const { SMSSecurityService } = require('../services/SMSSecurityService');
        const securityService = SMSSecurityService.getInstance();
        const securityCheck = await securityService.validateSMSRequest(phoneNumber, message, userId, req.ip);
        const response = {
            success: true,
            data: {
                phoneNumber: phoneNumber,
                message: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                securityCheck: securityCheck,
                testResult: securityCheck.isAllowed ? 'ALLOWED' : 'BLOCKED'
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
        logger_1.default.error('Error testing SMS security:', error);
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=smsController.js.map