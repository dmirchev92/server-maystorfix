// SMS Security Middleware - Integrates all SMS security checks
// Validates SMS requests before they are processed

import { Request, Response, NextFunction } from 'express';
import { SMSSecurityService } from '../services/SMSSecurityService';
import { SMSActivityService } from '../services/SMSActivityService';
import logger from '../utils/logger';

const smsSecurityService = SMSSecurityService.getInstance();
const smsActivityService = new SMSActivityService();

export interface SMSSecurityRequest extends Request {
  smsSecurityCheck?: {
    isAllowed: boolean;
    riskLevel: string;
    reason?: string;
  };
}

/**
 * SMS Security Middleware - validates all SMS requests
 */
export const validateSMSRequest = async (
  req: SMSSecurityRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
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

    logger.info('🔒 SMS Security Validation Started', {
      userId,
      phoneNumber: maskPhoneNumber(phoneNumber),
      messageLength: message.length,
      ipAddress: maskIP(ipAddress)
    });

    // 1. Check if user can send SMS (rate limits, etc.)
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

    // 2. Comprehensive security validation
    const securityCheck = await smsSecurityService.validateSMSRequest(
      phoneNumber, 
      message, 
      userId, 
      ipAddress
    );

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

    // 3. Check for suspicious activity patterns
    const suspiciousActivity = await smsActivityService.detectSuspiciousActivity(userId);
    if (suspiciousActivity.isSuspicious && suspiciousActivity.riskLevel === 'critical') {
      await logSecurityEvent(userId, phoneNumber, message, ipAddress, false, 
        `Suspicious activity detected: ${suspiciousActivity.reasons.join(', ')}`);
      
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

    // Store security check results for later use
    req.smsSecurityCheck = {
      isAllowed: true,
      riskLevel: securityCheck.riskLevel,
      reason: suspiciousActivity.isSuspicious ? 
        `Suspicious patterns detected: ${suspiciousActivity.reasons.join(', ')}` : undefined
    };

    logger.info('✅ SMS Security Validation Passed', {
      userId,
      phoneNumber: maskPhoneNumber(phoneNumber),
      riskLevel: securityCheck.riskLevel,
      suspiciousActivity: suspiciousActivity.isSuspicious
    });

    next();

  } catch (error) {
    logger.error('❌ SMS Security Middleware Error', { error });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SECURITY_CHECK_FAILED',
        message: 'Security validation failed'
      }
    });
  }
};

/**
 * Log successful SMS sending (call this after SMS is sent)
 */
export const logSuccessfulSMS = async (
  req: SMSSecurityRequest,
  phoneNumber: string,
  message: string
): Promise<void> => {
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

    logger.info('📊 SMS Success Logged', {
      userId,
      phoneNumber: maskPhoneNumber(phoneNumber),
      messageLength: message.length
    });

  } catch (error) {
    logger.error('❌ Failed to log successful SMS', { error });
  }
};

/**
 * Log security event (blocked SMS, suspicious activity, etc.)
 */
async function logSecurityEvent(
  userId: string,
  phoneNumber: string,
  message: string,
  ipAddress: string,
  success: boolean,
  reason?: string
): Promise<void> {
  try {
    await smsActivityService.logActivity({
      userId,
      phoneNumber,
      messageLength: message.length,
      ipAddress,
      success,
      riskLevel: success ? 'low' : 'high'
    });

    logger.warn('🚨 SMS Security Event Logged', {
      userId,
      phoneNumber: maskPhoneNumber(phoneNumber),
      success,
      reason,
      ipAddress: maskIP(ipAddress)
    });

  } catch (error) {
    logger.error('❌ Failed to log security event', { error });
  }
}

/**
 * Mask phone number for logging (privacy)
 */
function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= 4) return '***';
  return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 2);
}

/**
 * Mask IP address for logging (privacy)
 */
function maskIP(ipAddress: string): string {
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

export default {
  validateSMSRequest,
  logSuccessfulSMS
};
