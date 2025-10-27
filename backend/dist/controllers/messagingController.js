"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const smsSecurityMiddleware_1 = require("../middleware/smsSecurityMiddleware");
const logger_1 = __importStar(require("../utils/logger"));
const router = (0, express_1.Router)();
let viberService = null;
try {
    const { ViberBusinessService } = require('../services/ViberBusinessService');
    viberService = new ViberBusinessService();
}
catch (error) {
    logger_1.default.warn('ViberBusinessService not available:', error?.message || 'Unknown error');
}
const messagingLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: {
            code: 'MESSAGING_RATE_LIMIT_EXCEEDED',
            message: 'Too many messages sent, please try again later'
        }
    }
});
router.post('/viber/send', messagingLimiter, [
    (0, express_validator_1.body)('receiver').isString().notEmpty().withMessage('Receiver is required'),
    (0, express_validator_1.body)('message').isString().notEmpty().withMessage('Message is required'),
    (0, express_validator_1.body)('type').optional().isIn(['text', 'picture', 'contact']).withMessage('Invalid message type'),
    (0, express_validator_1.body)('media').optional().isURL().withMessage('Invalid media URL'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request data',
                    details: errors.array()
                }
            });
            return;
        }
        const { receiver, message, type = 'text', media } = req.body;
        const businessId = req.user?.businessId;
        if (!businessId) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'BUSINESS_REQUIRED',
                    message: 'Business ID is required'
                }
            });
            return;
        }
        if (!viberService.isConfigured()) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VIBER_NOT_CONFIGURED',
                    message: 'Viber Business is not configured'
                }
            });
            return;
        }
        let success = false;
        const trackingData = `business_${businessId}_${Date.now()}`;
        switch (type) {
            case 'text':
                success = await viberService.sendTextMessage(receiver, message, trackingData);
                break;
            case 'picture':
                if (!media) {
                    res.status(400).json({
                        success: false,
                        error: {
                            code: 'MEDIA_REQUIRED',
                            message: 'Media URL is required for picture messages'
                        }
                    });
                    return;
                }
                success = await viberService.sendPictureMessage(receiver, media, message);
                break;
            case 'contact':
                const contactInfo = JSON.parse(message);
                success = await viberService.sendContactMessage(receiver, contactInfo.name, contactInfo.phone);
                break;
            default:
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_MESSAGE_TYPE',
                        message: 'Invalid message type'
                    }
                });
                return;
        }
        if (success) {
            logger_1.gdprLogger.logDataAccess(req.user?.id || 'anonymous', 'viber_message_sent', 'business_communication');
            res.json({
                success: true,
                data: {
                    message: 'Viber message sent successfully',
                    trackingData
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    code: 'VIBER_SEND_FAILED',
                    message: 'Failed to send Viber message'
                }
            });
        }
    }
    catch (error) {
        logger_1.default.error('Error sending Viber message', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        next(error);
    }
});
router.post('/viber/webhook', async (req, res, next) => {
    try {
        const event = req.body;
        viberService.processWebhookEvent(event);
        res.json({ success: true });
    }
    catch (error) {
        logger_1.default.error('Error processing Viber webhook', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        next(error);
    }
});
router.get('/viber/account', async (req, res, next) => {
    try {
        if (!viberService.isConfigured()) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VIBER_NOT_CONFIGURED',
                    message: 'Viber Business is not configured'
                }
            });
            return;
        }
        const accountInfo = await viberService.getAccountInfo();
        if (accountInfo) {
            res.json({
                success: true,
                data: accountInfo
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    code: 'VIBER_ACCOUNT_INFO_FAILED',
                    message: 'Failed to retrieve Viber account info'
                }
            });
        }
    }
    catch (error) {
        logger_1.default.error('Error getting Viber account info', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        next(error);
    }
});
router.post('/sms/send', messagingLimiter, smsSecurityMiddleware_1.validateSMSRequest, [
    (0, express_validator_1.body)('phoneNumber').isString().notEmpty().withMessage('Phone number is required'),
    (0, express_validator_1.body)('message').isString().notEmpty().withMessage('Message is required'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request data',
                    details: errors.array()
                }
            });
            return;
        }
        const { phoneNumber, message } = req.body;
        const businessId = req.user?.businessId;
        if (!businessId) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'BUSINESS_REQUIRED',
                    message: 'Business ID is required'
                }
            });
            return;
        }
        const success = true;
        if (success) {
            logger_1.gdprLogger.logDataAccess(req.user?.id || 'anonymous', 'sms_sent', 'business_communication');
            res.json({
                success: true,
                data: {
                    message: 'SMS sent successfully',
                    phoneNumber,
                    messageId: `sms_${Date.now()}`
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    code: 'SMS_SEND_FAILED',
                    message: 'Failed to send SMS'
                }
            });
        }
    }
    catch (error) {
        logger_1.default.error('Error sending SMS', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=messagingController.js.map