"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSuccessfulSMS = exports.validateSMSRequest = void 0;
const SMSSecurityService_1 = require("../services/SMSSecurityService");
const SMSActivityService_1 = require("../services/SMSActivityService");
const logger_1 = __importDefault(require("../utils/logger"));
const smsSecurityService = SMSSecurityService_1.SMSSecurityService.getInstance();
const smsActivityService = new SMSActivityService_1.SMSActivityService();
const validateSMSRequest = async (req, res, next) => {
    try {
        const { phoneNumber, message } = req.body;
        const userId = req.user?.id || 'anonymous';
        const ipAddress = req.ip || 'unknown';
        if (!phoneNumber || !message) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Phone number and message are required'
                }
            });
            return;
        }
        logger_1.default.info('🔒 SMS Security Validation Started', {
            userId,
            phoneNumber: maskPhoneNumber(phoneNumber),
            messageLength: message.length,
            ipAddress: maskIP(ipAddress)
        });
        const limitCheck = await smsActivityService.canUserSendSMS(userId);
        if (!limitCheck.canSend) {
            await logSecurityEvent(userId, phoneNumber, message, ipAddress, false, limitCheck.reason);
            res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: limitCheck.reason
                }
            });
            return;
        }
        const securityCheck = await smsSecurityService.validateSMSRequest(phoneNumber, message, userId, ipAddress);
        if (!securityCheck.isAllowed) {
            await logSecurityEvent(userId, phoneNumber, message, ipAddress, false, securityCheck.reason);
            res.status(403).json({
                success: false,
                error: {
                    code: 'SMS_BLOCKED',
                    message: securityCheck.reason || 'SMS request blocked for security reasons',
                    riskLevel: securityCheck.riskLevel
                }
            });
            return;
        }
        const suspiciousActivity = await smsActivityService.detectSuspiciousActivity(userId);
        if (suspiciousActivity.isSuspicious && suspiciousActivity.riskLevel === 'critical') {
            await logSecurityEvent(userId, phoneNumber, message, ipAddress, false, `Suspicious activity detected: ${suspiciousActivity.reasons.join(', ')}`);
            res.status(403).json({
                success: false,
                error: {
                    code: 'SUSPICIOUS_ACTIVITY',
                    message: 'Account temporarily restricted due to suspicious activity',
                    reasons: suspiciousActivity.reasons
                }
            });
            return;
        }
        req.smsSecurityCheck = {
            isAllowed: true,
            riskLevel: securityCheck.riskLevel,
            reason: suspiciousActivity.isSuspicious ?
                `Suspicious patterns detected: ${suspiciousActivity.reasons.join(', ')}` : undefined
        };
        logger_1.default.info('✅ SMS Security Validation Passed', {
            userId,
            phoneNumber: maskPhoneNumber(phoneNumber),
            riskLevel: securityCheck.riskLevel,
            suspiciousActivity: suspiciousActivity.isSuspicious
        });
        next();
    }
    catch (error) {
        logger_1.default.error('❌ SMS Security Middleware Error', { error });
        res.status(500).json({
            success: false,
            error: {
                code: 'SECURITY_CHECK_FAILED',
                message: 'Security validation failed'
            }
        });
    }
};
exports.validateSMSRequest = validateSMSRequest;
const logSuccessfulSMS = async (req, phoneNumber, message) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const ipAddress = req.ip || 'unknown';
        await smsActivityService.logActivity({
            userId,
            phoneNumber,
            messageLength: message.length,
            ipAddress,
            success: true,
            riskLevel: req.smsSecurityCheck?.riskLevel || 'low'
        });
        logger_1.default.info('📊 SMS Success Logged', {
            userId,
            phoneNumber: maskPhoneNumber(phoneNumber),
            messageLength: message.length
        });
    }
    catch (error) {
        logger_1.default.error('❌ Failed to log successful SMS', { error });
    }
};
exports.logSuccessfulSMS = logSuccessfulSMS;
async function logSecurityEvent(userId, phoneNumber, message, ipAddress, success, reason) {
    try {
        await smsActivityService.logActivity({
            userId,
            phoneNumber,
            messageLength: message.length,
            ipAddress,
            success,
            riskLevel: success ? 'low' : 'high'
        });
        logger_1.default.warn('🚨 SMS Security Event Logged', {
            userId,
            phoneNumber: maskPhoneNumber(phoneNumber),
            success,
            reason,
            ipAddress: maskIP(ipAddress)
        });
    }
    catch (error) {
        logger_1.default.error('❌ Failed to log security event', { error });
    }
}
function maskPhoneNumber(phoneNumber) {
    if (phoneNumber.length <= 4)
        return '***';
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 2);
}
function maskIP(ipAddress) {
    if (!ipAddress || ipAddress === 'unknown') {
        return 'unknown';
    }
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    if (ipAddress.length <= 3) {
        return '***';
    }
    return ipAddress.substring(0, ipAddress.length - 3) + '***';
}
exports.default = {
    validateSMSRequest: exports.validateSMSRequest,
    logSuccessfulSMS: exports.logSuccessfulSMS
};
//# sourceMappingURL=smsSecurityMiddleware.js.map