// Mobica SMS Service - Bulgarian SMS provider
// API Documentation: https://gate.mobica.bg/v2/multi/json/sms.php

import axios from 'axios';
import logger from '../utils/logger';
import { ServiceTextProError } from '../types';

interface MobicaSMSRequest {
  user: string;
  pass: string;
  sms: Array<{
    idd: string;
    phone: number;
    message: string;
    from?: string;
  }>;
}

interface MobicaResponse {
  code: string;
  description: string;
}

export class MobicaService {
  private readonly apiUrl = 'https://gate.mobica.bg/v2/multi/json/sms.php';
  private readonly username: string;
  private readonly password: string;
  private readonly senderId: string;
  private isConfigured: boolean = false;

  constructor() {
    this.username = process.env.MOBICA_USERNAME || '';
    this.password = process.env.MOBICA_PASSWORD || '';
    this.senderId = process.env.MOBICA_SENDER_ID || 'MaystorFix';

    if (this.username && this.password) {
      this.isConfigured = true;
      logger.info('✅ MobicaService initialized successfully', {
        username: this.username,
        senderId: this.senderId
      });
    } else {
      logger.warn('⚠️ MobicaService not configured - missing credentials');
    }
  }

  /**
   * Check if Mobica is properly configured
   */
  public isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Format phone number to Mobica format (359XXXXXXXXX)
   * Removes +, spaces, and ensures it starts with country code
   */
  public formatPhoneNumber(phoneNumber: string, defaultCountryCode: string = '359'): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // If starts with 00, remove it
    if (cleaned.startsWith('00')) {
      cleaned = cleaned.substring(2);
    }

    // If starts with +, it's already removed by regex
    // If doesn't start with country code, add it
    if (!cleaned.startsWith(defaultCountryCode)) {
      // Remove leading 0 if present (Bulgarian mobile numbers)
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      cleaned = defaultCountryCode + cleaned;
    }

    return cleaned;
  }

  /**
   * Send SMS via Mobica
   */
  public async sendSMS(
    phoneNumber: string,
    message: string,
    messageId?: string
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      if (!this.isConfigured) {
        throw new ServiceTextProError(
          'Mobica SMS service is not configured',
          'MOBICA_NOT_CONFIGURED',
          503
        );
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      logger.info('📱 [MOBICA] Sending SMS', {
        phone: formattedPhone,
        messageLength: message.length,
        messageId: messageId || 'auto'
      });

      // Prepare request
      // Convert phone to integer as required by Mobica API
      const phoneAsInteger = parseInt(formattedPhone, 10);
      
      const request: MobicaSMSRequest = {
        user: this.username,
        pass: this.password,
        sms: [
          {
            idd: messageId || `msg_${Date.now()}`,
            phone: phoneAsInteger,
            message: message,
            from: this.senderId
          }
        ]
      };

      // Send request
      logger.info('📤 [MOBICA] Sending request', {
        url: this.apiUrl,
        username: this.username,
        phone: formattedPhone
      });

      const response = await axios.post<MobicaResponse>(
        this.apiUrl,
        request,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      logger.info('📥 [MOBICA] Response received', {
        status: response.status,
        data: response.data
      });

      // Check response
      if (response.data.code === '1004') {
        logger.info('✅ [MOBICA] SMS sent successfully', {
          phone: formattedPhone,
          messageId: messageId,
          response: response.data
        });

        return {
          success: true,
          messageId: messageId || `msg_${Date.now()}`
        };
      } else {
        logger.error('❌ [MOBICA] SMS failed', {
          phone: formattedPhone,
          code: response.data.code,
          description: response.data.description
        });

        return {
          success: false,
          error: this.getErrorMessage(response.data.code)
        };
      }
    } catch (error: any) {
      logger.error('❌ [MOBICA] SMS send error', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        phone: phoneNumber
      });

      return {
        success: false,
        error: error.response?.data?.description || error.message || 'Failed to send SMS'
      };
    }
  }

  /**
   * Send missed call SMS with chat link
   */
  public async sendMissedCallSMS(
    phoneNumber: string,
    userId: string,
    businessName: string
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      // Import ChatTokenService dynamically to avoid circular dependency
      const { ChatTokenService } = await import('./ChatTokenService');
      const chatTokenService = new ChatTokenService();

      // Get chat URL for this user
      const chatUrl = await chatTokenService.getChatUrlForUser(userId);

      // Build message in Latin (160 chars max for single SMS)
      const message = `Zaet sum, skoro shte vi vurna obajdane. Mojete da zapochnete Chat tuk: ${chatUrl}\n${businessName}`;

      logger.info('📱 [MOBICA] Sending missed call SMS', {
        phone: phoneNumber,
        userId,
        businessName,
        messageLength: message.length
      });

      // Send SMS
      const messageId = `call_${Date.now()}`;
      return await this.sendSMS(phoneNumber, message, messageId);
    } catch (error: any) {
      logger.error('❌ [MOBICA] Failed to send missed call SMS', {
        error: error.message,
        phone: phoneNumber,
        userId
      });

      return {
        success: false,
        error: error.message || 'Failed to send missed call SMS'
      };
    }
  }

  /**
   * Get human-readable error message from Mobica error code
   */
  private getErrorMessage(code: string): string {
    const errorMessages: { [key: string]: string } = {
      '1004': 'Message accepted',
      '1005': 'Rejected request',
      '1006': 'Invalid phone number',
      '1007': 'Invalid schedule data',
      '1008': 'Invalid request format',
      '1115': 'Invalid username or password',
      '1117': 'Insufficient funds',
      '1120': 'Missing required field',
      '1121': 'Unauthorized IP address',
      '1122': 'Account not active'
    };

    return errorMessages[code] || `Unknown error (code: ${code})`;
  }
}
