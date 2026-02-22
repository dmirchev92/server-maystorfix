/**
 * SMS Verification Service
 * Handles phone number verification via SMS codes during registration
 */

import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import { MobicaService } from './MobicaService';
import logger from '../utils/logger';

const CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_MINUTES = 5; // Can't request new code for same number within 5 minutes

export interface VerificationResult {
  success: boolean;
  message: string;
  code?: string;
}

export class SMSVerificationService {
  private database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;
  private mobicaService: MobicaService;

  constructor() {
    this.mobicaService = new MobicaService();
  }

  /**
   * Generate a 6-digit verification code
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send SMS verification code
   */
  async sendVerificationCode(
    phoneNumber: string,
    ipAddress?: string
  ): Promise<VerificationResult> {
    try {
      // Format phone number
      const formattedPhone = this.mobicaService.formatPhoneNumber(phoneNumber);

      logger.info('📱 Sending SMS verification code', {
        phone: this.maskPhone(formattedPhone),
        ip: ipAddress
      });

      // Check rate limiting - can't send to same number within 5 minutes
      const recentCode = await this.database.query(
        `SELECT id, created_at FROM sms_verification_codes
         WHERE phone_number = $1
         AND created_at > NOW() - INTERVAL '${RATE_LIMIT_MINUTES} minutes'
         ORDER BY created_at DESC
         LIMIT 1`,
        [formattedPhone]
      );

      if (recentCode && recentCode.length > 0) {
        const waitTime = RATE_LIMIT_MINUTES - Math.floor(
          (Date.now() - new Date(recentCode[0].created_at).getTime()) / 60000
        );
        logger.warn('⏱️ Rate limit hit for phone verification', {
          phone: this.maskPhone(formattedPhone)
        });
        return {
          success: false,
          message: `Моля, изчакайте ${waitTime} минути преди да поискате нов код.`
        };
      }

      // Generate verification code
      const code = this.generateCode();
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60000);

      // Save code to database
      await this.database.query(
        `INSERT INTO sms_verification_codes 
         (phone_number, code, expires_at, ip_address, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [formattedPhone, code, expiresAt, ipAddress]
      );

      // Send SMS via Mobica
      const message = `Вашият код за потвърждение е: ${code}\n\nКодът е валиден ${CODE_EXPIRY_MINUTES} минути.\n\nSnapFix`;
      
      const smsResult = await this.mobicaService.sendSMS(
        formattedPhone,
        message,
        `verify_${Date.now()}`
      );

      if (smsResult.success) {
        logger.info('✅ Verification SMS sent successfully', {
          phone: this.maskPhone(formattedPhone),
          messageId: smsResult.messageId
        });
        
        return {
          success: true,
          message: 'Кодът за потвърждение е изпратен на вашия телефон.',
          code: process.env.NODE_ENV === 'development' ? code : undefined // Only in dev
        };
      } else {
        logger.error('❌ Failed to send verification SMS', {
          phone: this.maskPhone(formattedPhone),
          error: smsResult.error
        });
        
        return {
          success: false,
          message: 'Грешка при изпращане на SMS. Моля, опитайте отново.'
        };
      }

    } catch (error) {
      logger.error('❌ Error sending verification code', { error });
      return {
        success: false,
        message: 'Системна грешка. Моля, опитайте отново.'
      };
    }
  }

  /**
   * Verify SMS code
   */
  async verifyCode(
    phoneNumber: string,
    code: string
  ): Promise<VerificationResult> {
    try {
      // Format phone number
      const formattedPhone = this.mobicaService.formatPhoneNumber(phoneNumber);

      logger.info('🔍 Verifying SMS code', {
        phone: this.maskPhone(formattedPhone)
      });

      // Get the latest non-verified code for this phone
      const verificationRecord = await this.database.query(
        `SELECT id, code, expires_at, attempts, verified
         FROM sms_verification_codes
         WHERE phone_number = $1
         AND verified = FALSE
         ORDER BY created_at DESC
         LIMIT 1`,
        [formattedPhone]
      );

      if (!verificationRecord || verificationRecord.length === 0) {
        logger.warn('⚠️ No verification code found', {
          phone: this.maskPhone(formattedPhone)
        });
        return {
          success: false,
          message: 'Няма активен код за потвърждение. Моля, поискайте нов код.'
        };
      }

      const record = verificationRecord[0];

      // Check if code is expired
      if (new Date(record.expires_at) < new Date()) {
        logger.warn('⏰ Verification code expired', {
          phone: this.maskPhone(formattedPhone)
        });
        return {
          success: false,
          message: 'Кодът е изтекъл. Моля, поискайте нов код.'
        };
      }

      // Check max attempts
      if (record.attempts >= MAX_ATTEMPTS) {
        logger.warn('🚫 Max verification attempts reached', {
          phone: this.maskPhone(formattedPhone)
        });
        return {
          success: false,
          message: 'Превишен брой опити. Моля, поискайте нов код.'
        };
      }

      // Increment attempts
      await this.database.query(
        `UPDATE sms_verification_codes
         SET attempts = attempts + 1
         WHERE id = $1`,
        [record.id]
      );

      // Check if code matches
      if (record.code !== code) {
        logger.warn('❌ Invalid verification code', {
          phone: this.maskPhone(formattedPhone),
          attemptsLeft: MAX_ATTEMPTS - record.attempts - 1
        });
        return {
          success: false,
          message: `Невалиден код. Остават ${MAX_ATTEMPTS - record.attempts - 1} опита.`
        };
      }

      // Mark as verified
      await this.database.query(
        `UPDATE sms_verification_codes
         SET verified = TRUE, verified_at = NOW()
         WHERE id = $1`,
        [record.id]
      );

      logger.info('✅ Phone number verified successfully', {
        phone: this.maskPhone(formattedPhone)
      });

      return {
        success: true,
        message: 'Телефонът е потвърден успешно!'
      };

    } catch (error) {
      logger.error('❌ Error verifying code', { error });
      return {
        success: false,
        message: 'Системна грешка. Моля, опитайте отново.'
      };
    }
  }

  /**
   * Check if phone number is verified
   */
  async isPhoneVerified(phoneNumber: string): Promise<boolean> {
    try {
      const formattedPhone = this.mobicaService.formatPhoneNumber(phoneNumber);
      
      const result = await this.database.query(
        `SELECT id FROM sms_verification_codes
         WHERE phone_number = $1
         AND verified = TRUE
         ORDER BY verified_at DESC
         LIMIT 1`,
        [formattedPhone]
      );

      return result && result.length > 0;
    } catch (error) {
      logger.error('❌ Error checking phone verification', { error });
      return false;
    }
  }

  /**
   * Clean up expired verification codes (run periodically)
   */
  async cleanupExpiredCodes(): Promise<void> {
    try {
      const result = await this.database.query(
        `DELETE FROM sms_verification_codes
         WHERE expires_at < NOW() - INTERVAL '24 hours'`
      );

      logger.info('🧹 Cleaned up expired verification codes', {
        deleted: (result as any).rowCount || 0
      });
    } catch (error) {
      logger.error('❌ Error cleaning up verification codes', { error });
    }
  }

  // Helper methods
  private maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return '***';
    return phone.substring(0, 4) + '***' + phone.substring(phone.length - 2);
  }
}

export default new SMSVerificationService();
