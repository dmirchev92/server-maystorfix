// SMS Security Service - Protects against SMS destination hijacking and abuse
// Implements comprehensive security measures for SMS sending

import logger from '../utils/logger';
import config from '../utils/config';

export interface SMSSecurityCheck {
  isAllowed: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  blockedReason?: string;
}

export interface SMSDestinationAnalysis {
  phoneNumber: string;
  isPremium: boolean;
  isInternational: boolean;
  countryCode?: string;
  carrier?: string;
  riskScore: number;
  flags: string[];
}

export class SMSSecurityService {
  private static instance: SMSSecurityService;
  
  // LAYER 1: Bulgarian premium number patterns (comprehensive list)
  private readonly PREMIUM_PATTERNS = [
    /^1\d{3,4}$/,           // 1234, 12345 (premium services)
    /^0900\d+$/,            // 0900 numbers (premium)
    /^090\d+$/,             // 090 numbers (premium)
    /^\+1900\d+$/,          // International premium
    /^\+3591\d{3,4}$/,      // Bulgarian premium with country code
    /^18\d{2}$/,            // 1800-1899 range
    /^19\d{2}$/,            // 1900-1999 range
    /^0901\d+$/,            // Extended premium range
    /^0902\d+$/,            // Extended premium range
    /^0903\d+$/,            // Extended premium range
  ];

  // LAYER 2: Additional premium number patterns (extra protection)
  private readonly EXTENDED_PREMIUM_PATTERNS = [
    /^0904\d+$/,            // 0904 premium range
    /^0905\d+$/,            // 0905 premium range
    /^0906\d+$/,            // 0906 premium range
    /^0907\d+$/,            // 0907 premium range
    /^0908\d+$/,            // 0908 premium range
    /^0909\d+$/,            // 0909 premium range
    /^\+359900\d+$/,        // Bulgarian 0900 with country code
    /^\+359901\d+$/,        // Bulgarian 0901 with country code
    /^\+359902\d+$/,        // Bulgarian 0902 with country code
    /^\+359903\d+$/,        // Bulgarian 0903 with country code
    /^\+359904\d+$/,        // Bulgarian 0904 with country code
    /^\+359905\d+$/,        // Bulgarian 0905 with country code
    /^\+359906\d+$/,        // Bulgarian 0906 with country code
    /^\+359907\d+$/,        // Bulgarian 0907 with country code
    /^\+359908\d+$/,        // Bulgarian 0908 with country code
    /^\+359909\d+$/,        // Bulgarian 0909 with country code
    /^1[0-9]{3,5}$/,        // All 1xxxx numbers (broad protection)
    /^\+1900\d+$/,          // US premium
    /^\+1976\d+$/,          // Caribbean premium
    /^\+44900\d+$/,         // UK premium
    /^\+49900\d+$/,         // German premium
    /^\+33899\d+$/,         // French premium
  ];

  // LAYER 3: Suspicious number characteristics
  private readonly SUSPICIOUS_NUMBER_CHARACTERISTICS = [
    /^[0-9]{1,4}$/,         // Very short numbers (1-4 digits)
    /^[0-9]{15,}$/,         // Very long numbers (15+ digits)
    /^\*\d+$/,              // Star codes (*123)
    /^#\d+$/,               // Hash codes (#123)
    /^\*\d+\*$/,            // Star codes with ending (*123*)
    /^#\d+#$/,              // Hash codes with ending (#123#)
  ];

  // Suspicious content patterns
  private readonly SUSPICIOUS_CONTENT_PATTERNS = [
    /premium/i,
    /charge/i,
    /bill/i,
    /cost/i,
    /pay/i,
    /money/i,
    /cash/i,
    /win/i,
    /prize/i,
    /lottery/i,
    /click here/i,
    /urgent/i,
    /act now/i,
    /limited time/i,
    /http[s]?:\/\/(?!192\.168\.0\.129)/i, // Block external URLs except our own
  ];

  // Rate limiting storage (in production, use Redis)
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  public static getInstance(): SMSSecurityService {
    if (!SMSSecurityService.instance) {
      SMSSecurityService.instance = new SMSSecurityService();
    }
    return SMSSecurityService.instance;
  }

  /**
   * Comprehensive SMS security check
   */
  async validateSMSRequest(
    phoneNumber: string, 
    message: string, 
    userId: string,
    ipAddress?: string
  ): Promise<SMSSecurityCheck> {
    try {
      logger.info('🔒 SMS Security Check Started', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        userId,
        messageLength: message.length,
        ipAddress: ipAddress ? this.maskIP(ipAddress) : 'unknown'
      });

      // 1. Check destination number security
      const destinationCheck = this.analyzeDestination(phoneNumber);
      if (!destinationCheck.isAllowed) {
        logger.warn('🚨 SMS BLOCKED - Dangerous destination', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          reason: destinationCheck.reason,
          riskLevel: destinationCheck.riskLevel
        });
        return destinationCheck;
      }

      // 2. Check message content security
      const contentCheck = this.analyzeMessageContent(message);
      if (!contentCheck.isAllowed) {
        logger.warn('🚨 SMS BLOCKED - Suspicious content', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          reason: contentCheck.reason,
          riskLevel: contentCheck.riskLevel
        });
        return contentCheck;
      }

      // 3. Check rate limiting
      const rateLimitCheck = this.checkRateLimit(userId, ipAddress);
      if (!rateLimitCheck.isAllowed) {
        logger.warn('🚨 SMS BLOCKED - Rate limit exceeded', {
          userId,
          ipAddress: ipAddress ? this.maskIP(ipAddress) : 'unknown',
          reason: rateLimitCheck.reason
        });
        return rateLimitCheck;
      }

      // 4. Check user behavior patterns
      const behaviorCheck = await this.analyzeBehaviorPatterns(userId);
      if (!behaviorCheck.isAllowed) {
        logger.warn('🚨 SMS BLOCKED - Suspicious behavior', {
          userId,
          reason: behaviorCheck.reason,
          riskLevel: behaviorCheck.riskLevel
        });
        return behaviorCheck;
      }

      logger.info('✅ SMS Security Check Passed', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        userId,
        checks: ['destination', 'content', 'rateLimit', 'behavior']
      });

      return {
        isAllowed: true,
        riskLevel: 'low'
      };

    } catch (error) {
      logger.error('❌ SMS Security Check Failed', { error, phoneNumber: this.maskPhoneNumber(phoneNumber) });
      return {
        isAllowed: false,
        reason: 'Security check failed',
        riskLevel: 'critical',
        blockedReason: 'SECURITY_CHECK_ERROR'
      };
    }
  }

  /**
   * Analyze SMS destination for security risks - MULTI-LAYER PROTECTION
   */
  private analyzeDestination(phoneNumber: string): SMSSecurityCheck {
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // LAYER 1: Check primary premium patterns
    const isPremiumLayer1 = this.PREMIUM_PATTERNS.some(pattern => pattern.test(cleanNumber));
    if (isPremiumLayer1) {
      logger.warn('🚨 LAYER 1 BLOCK: Primary premium pattern detected', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        pattern: 'PRIMARY_PREMIUM'
      });
      return {
        isAllowed: false,
        reason: 'Premium number detected (Layer 1) - potential financial risk',
        riskLevel: 'critical',
        blockedReason: 'PREMIUM_NUMBER_L1'
      };
    }

    // LAYER 2: Check extended premium patterns
    const isPremiumLayer2 = this.EXTENDED_PREMIUM_PATTERNS.some(pattern => pattern.test(cleanNumber));
    if (isPremiumLayer2) {
      logger.warn('🚨 LAYER 2 BLOCK: Extended premium pattern detected', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        pattern: 'EXTENDED_PREMIUM'
      });
      return {
        isAllowed: false,
        reason: 'Premium number detected (Layer 2) - extended protection',
        riskLevel: 'critical',
        blockedReason: 'PREMIUM_NUMBER_L2'
      };
    }

    // LAYER 3: Check suspicious characteristics
    const isSuspiciousLayer3 = this.SUSPICIOUS_NUMBER_CHARACTERISTICS.some(pattern => pattern.test(cleanNumber));
    if (isSuspiciousLayer3) {
      logger.warn('🚨 LAYER 3 BLOCK: Suspicious number characteristics detected', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        pattern: 'SUSPICIOUS_CHARACTERISTICS'
      });
      return {
        isAllowed: false,
        reason: 'Suspicious number characteristics detected (Layer 3)',
        riskLevel: 'high',
        blockedReason: 'SUSPICIOUS_NUMBER_L3'
      };
    }

    // Continue with existing analysis for allowed numbers
    const analysis = this.analyzePhoneNumber(phoneNumber);
    
    // Flag international numbers (allow but log)
    if (analysis.isInternational) {
      logger.info('⚠️ International SMS detected (passed all layers)', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        countryCode: analysis.countryCode,
        riskScore: analysis.riskScore
      });
      
      // Block high-risk international numbers
      if (analysis.riskScore > 7) {
        return {
          isAllowed: false,
          reason: 'High-risk international destination',
          riskLevel: 'high',
          blockedReason: 'HIGH_RISK_INTERNATIONAL'
        };
      }
    }

    logger.info('✅ Number passed all 3 security layers', {
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      layers: ['PRIMARY_PREMIUM', 'EXTENDED_PREMIUM', 'SUSPICIOUS_CHARACTERISTICS'],
      finalRiskLevel: analysis.riskScore > 5 ? 'medium' : 'low'
    });

    return {
      isAllowed: true,
      riskLevel: analysis.riskScore > 5 ? 'medium' : 'low'
    };
  }

  /**
   * Analyze phone number patterns
   */
  private analyzePhoneNumber(phoneNumber: string): SMSDestinationAnalysis {
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    const flags: string[] = [];
    let riskScore = 0;

    // Check for premium patterns
    const isPremium = this.PREMIUM_PATTERNS.some(pattern => pattern.test(cleanNumber));
    if (isPremium) {
      flags.push('PREMIUM_NUMBER');
      riskScore += 10;
    }

    // Check for international numbers
    const isInternational = cleanNumber.startsWith('+') && !cleanNumber.startsWith('+359');
    let countryCode: string | undefined;
    
    if (isInternational) {
      flags.push('INTERNATIONAL');
      riskScore += 3;
      
      // Extract country code
      const match = cleanNumber.match(/^\+(\d{1,3})/);
      if (match) {
        countryCode = match[1];
        
        // High-risk country codes (example list)
        const highRiskCountries = ['1900', '900', '901', '902', '903'];
        if (highRiskCountries.includes(countryCode)) {
          flags.push('HIGH_RISK_COUNTRY');
          riskScore += 5;
        }
      }
    }

    // Check for suspicious patterns
    if (cleanNumber.length < 6) {
      flags.push('TOO_SHORT');
      riskScore += 4;
    }

    if (cleanNumber.length > 15) {
      flags.push('TOO_LONG');
      riskScore += 2;
    }

    return {
      phoneNumber: cleanNumber,
      isPremium,
      isInternational,
      countryCode,
      riskScore,
      flags
    };
  }

  /**
   * Analyze message content for security risks
   */
  private analyzeMessageContent(message: string): SMSSecurityCheck {
    const flags: string[] = [];
    let riskScore = 0;

    // Check for suspicious content patterns
    for (const pattern of this.SUSPICIOUS_CONTENT_PATTERNS) {
      if (pattern.test(message)) {
        flags.push(`SUSPICIOUS_CONTENT: ${pattern.source}`);
        riskScore += 2;
      }
    }

    // Check message length (very long messages might be spam)
    if (message.length > 500) {
      flags.push('LONG_MESSAGE');
      riskScore += 1;
    }

    // Check for excessive URLs
    const urlCount = (message.match(/http[s]?:\/\//g) || []).length;
    if (urlCount > 2) {
      flags.push('MULTIPLE_URLS');
      riskScore += 3;
    }

    // Block if risk score is too high
    if (riskScore >= 5) {
      return {
        isAllowed: false,
        reason: `Suspicious message content detected: ${flags.join(', ')}`,
        riskLevel: riskScore >= 8 ? 'critical' : 'high',
        blockedReason: 'SUSPICIOUS_CONTENT'
      };
    }

    return {
      isAllowed: true,
      riskLevel: riskScore > 2 ? 'medium' : 'low'
    };
  }

  /**
   * Check rate limiting per user and IP
   */
  private checkRateLimit(userId: string, ipAddress?: string): SMSSecurityCheck {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 10; // Max 10 SMS per 15 minutes per user

    // Check user rate limit
    const userKey = `user:${userId}`;
    const userLimit = this.rateLimitStore.get(userKey);
    
    if (userLimit) {
      if (now < userLimit.resetTime) {
        if (userLimit.count >= maxRequests) {
          return {
            isAllowed: false,
            reason: `Rate limit exceeded: ${userLimit.count}/${maxRequests} requests in 15 minutes`,
            riskLevel: 'medium',
            blockedReason: 'RATE_LIMIT_USER'
          };
        }
        userLimit.count++;
      } else {
        // Reset window
        this.rateLimitStore.set(userKey, { count: 1, resetTime: now + windowMs });
      }
    } else {
      this.rateLimitStore.set(userKey, { count: 1, resetTime: now + windowMs });
    }

    // Check IP rate limit if available
    if (ipAddress) {
      const ipKey = `ip:${ipAddress}`;
      const ipLimit = this.rateLimitStore.get(ipKey);
      
      if (ipLimit) {
        if (now < ipLimit.resetTime) {
          if (ipLimit.count >= maxRequests * 2) { // More lenient for IP (shared networks)
            return {
              isAllowed: false,
              reason: `IP rate limit exceeded: ${ipLimit.count}/${maxRequests * 2} requests in 15 minutes`,
              riskLevel: 'medium',
              blockedReason: 'RATE_LIMIT_IP'
            };
          }
          ipLimit.count++;
        } else {
          this.rateLimitStore.set(ipKey, { count: 1, resetTime: now + windowMs });
        }
      } else {
        this.rateLimitStore.set(ipKey, { count: 1, resetTime: now + windowMs });
      }
    }

    return { isAllowed: true, riskLevel: 'low' };
  }

  /**
   * Analyze user behavior patterns for anomalies
   */
  private async analyzeBehaviorPatterns(userId: string): Promise<SMSSecurityCheck> {
    // In a real implementation, this would check:
    // - Sudden spike in SMS requests
    // - Unusual time patterns
    // - Geographic anomalies
    // - Device fingerprint changes
    
    // For now, return safe
    return { isAllowed: true, riskLevel: 'low' };
  }

  /**
   * Mask phone number for logging (privacy)
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return '***';
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 2);
  }

  /**
   * Mask IP address for logging (privacy)
   */
  private maskIP(ipAddress: string): string {
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    return ipAddress.substring(0, ipAddress.length - 3) + '***';
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): any {
    return {
      rateLimitEntries: this.rateLimitStore.size,
      premiumPatterns: this.PREMIUM_PATTERNS.length,
      suspiciousPatterns: this.SUSPICIOUS_CONTENT_PATTERNS.length,
      lastCleanup: new Date().toISOString()
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, value] of this.rateLimitStore.entries()) {
      if (now >= value.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }
}

export default SMSSecurityService;
