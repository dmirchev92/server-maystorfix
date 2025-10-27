// Simplified Security Enhancement Service
// Core security features without complex dependencies

import crypto from 'crypto';
import { Request } from 'express';
import logger from '../utils/logger';

export class SecurityEnhancementService {
  private static instance: SecurityEnhancementService;
  
  // Failed login attempt tracking (in-memory for simplicity)
  private failedAttempts = new Map<string, { count: number; lastAttempt: number; blocked: boolean }>();

  public static getInstance(): SecurityEnhancementService {
    if (!SecurityEnhancementService.instance) {
      SecurityEnhancementService.instance = new SecurityEnhancementService();
    }
    return SecurityEnhancementService.instance;
  }

  constructor() {
    // Simple constructor - no database dependencies
    logger.info('✅ Security Enhancement Service initialized');
  }

  /**
   * 1. BRUTE FORCE PROTECTION - Simple but effective
   */
  async checkBruteForceProtection(email: string, ipAddress: string): Promise<{ 
    allowed: boolean; 
    reason?: string; 
    waitTime?: number;
    emailAttempts?: number;
    ipAttempts?: number;
    emailRemaining?: number;
    ipRemaining?: number;
    debugInfo?: any;
  }> {
    try {
      const emailKey = `email:${email}`;
      const ipKey = `ip:${ipAddress}`;
      const now = Date.now();
      const emailWindowMs = 15 * 60 * 1000; // 15 minutes for email
      const ipWindowMs = 60 * 60 * 1000; // 1 hour for IP (more lenient)
      const emailMaxAttempts = 5; // 5 attempts per email
      const ipMaxAttempts = 20; // 20 attempts per IP (more lenient)

      // Get current attempt counts
      const emailRecord = this.failedAttempts.get(emailKey);
      const ipRecord = this.failedAttempts.get(ipKey);
      const currentEmailAttempts = emailRecord?.count || 0;
      const currentIpAttempts = ipRecord?.count || 0;
      const emailRemaining = Math.max(0, emailMaxAttempts - currentEmailAttempts);
      const ipRemaining = Math.max(0, ipMaxAttempts - currentIpAttempts);

      // 1. CHECK EMAIL-BASED BLOCKING (Primary protection)
      if (emailRecord && emailRecord.blocked && (now - emailRecord.lastAttempt) < emailWindowMs) {
        const waitTime = Math.ceil((emailWindowMs - (now - emailRecord.lastAttempt)) / 1000);
        const availableAt = new Date(now + waitTime * 1000);
        const timeString = availableAt.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        logger.warn('🚨 Brute force protection: Email account locked', {
          email: this.maskEmail(email),
          attemptCount: emailRecord.count,
          availableAt: timeString
        });

        return { 
          allowed: false, 
          reason: `This account is temporarily locked due to multiple failed login attempts. Please try again at ${timeString} or reset your password.`,
          waitTime,
          emailAttempts: currentEmailAttempts,
          ipAttempts: currentIpAttempts,
          emailRemaining: 0,
          ipRemaining
        };
      }

      // 2. CHECK IP-BASED BLOCKING (Secondary protection - more lenient)
      if (ipRecord && ipRecord.blocked && (now - ipRecord.lastAttempt) < ipWindowMs) {
        const waitTime = Math.ceil((ipWindowMs - (now - ipRecord.lastAttempt)) / 1000);
        const availableAt = new Date(now + waitTime * 1000);
        const timeString = availableAt.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        logger.warn('🚨 Brute force protection: IP temporarily restricted', {
          ipAddress: this.maskIP(ipAddress),
          attemptCount: ipRecord.count,
          availableAt: timeString,
          reason: 'Too many failed attempts from this location'
        });

        return { 
          allowed: false, 
          reason: `Too many failed login attempts from your location. Please try again at ${timeString}. If you forgot your password, please use the password reset option.`,
          waitTime,
          emailAttempts: currentEmailAttempts,
          ipAttempts: currentIpAttempts,
          emailRemaining,
          ipRemaining: 0
        };
      }

      // Create debug info
      const debugInfo = {
        email: this.maskEmail(email),
        ipAddress: this.maskIP(ipAddress),
        emailAttempts: currentEmailAttempts,
        ipAttempts: currentIpAttempts,
        emailRemaining,
        ipRemaining,
        emailMaxAttempts,
        ipMaxAttempts,
        emailWindowMinutes: emailWindowMs / (60 * 1000),
        ipWindowMinutes: ipWindowMs / (60 * 1000)
      };

      return { 
        allowed: true, 
        emailAttempts: currentEmailAttempts,
        ipAttempts: currentIpAttempts,
        emailRemaining,
        ipRemaining,
        debugInfo
      };
    } catch (error) {
      logger.error('❌ Brute force check failed:', error);
      return { allowed: true }; // Fail open for safety
    }
  }

  /**
   * Record failed login attempt
   */
  recordFailedLogin(email: string, ipAddress: string): void {
    try {
      const emailKey = `email:${email}`;
      const ipKey = `ip:${ipAddress}`;
      const now = Date.now();
      const emailMaxAttempts = 5; // 5 attempts per email
      const ipMaxAttempts = 20; // 20 attempts per IP (more lenient)

      // Update email attempts (primary protection)
      const emailAttempts = this.failedAttempts.get(emailKey) || { count: 0, lastAttempt: 0, blocked: false };
      emailAttempts.count++;
      emailAttempts.lastAttempt = now;
      emailAttempts.blocked = emailAttempts.count >= emailMaxAttempts;
      this.failedAttempts.set(emailKey, emailAttempts);

      // Update IP attempts (secondary protection - more lenient)
      const ipAttempts = this.failedAttempts.get(ipKey) || { count: 0, lastAttempt: 0, blocked: false };
      ipAttempts.count++;
      ipAttempts.lastAttempt = now;
      ipAttempts.blocked = ipAttempts.count >= ipMaxAttempts;
      this.failedAttempts.set(ipKey, ipAttempts);

      // Log with appropriate severity
      const logLevel = emailAttempts.blocked ? 'error' : 'warn';
      const message = emailAttempts.blocked ? 
        '🔒 Account locked due to failed attempts' : 
        '⚠️ Failed login attempt recorded';

      logger[logLevel](message, {
        email: this.maskEmail(email),
        ipAddress: this.maskIP(ipAddress),
        emailAttempts: emailAttempts.count,
        ipAttempts: ipAttempts.count,
        emailBlocked: emailAttempts.blocked,
        ipBlocked: ipAttempts.blocked,
        nextAction: emailAttempts.blocked ? 'Account locked for 15 minutes' : 
                   ipAttempts.blocked ? 'IP restricted for 1 hour' : 'Continue monitoring'
      });
    } catch (error) {
      logger.error('❌ Failed to record failed login:', error);
    }
  }

  /**
   * Clear failed attempts on successful login
   */
  clearFailedAttempts(email: string, ipAddress: string): void {
    try {
      this.failedAttempts.delete(`email:${email}`);
      this.failedAttempts.delete(`ip:${ipAddress}`);
      
      logger.info('✅ Failed attempts cleared', {
        email: this.maskEmail(email),
        ipAddress: this.maskIP(ipAddress)
      });
    } catch (error) {
      logger.error('❌ Failed to clear attempts:', error);
    }
  }

  /**
   * 2. DEVICE FINGERPRINTING - Simple version
   */
  async analyzeDeviceFingerprint(req: Request, userId: string): Promise<{ trusted: boolean; isNewDevice: boolean; riskScore: number }> {
    try {
      const userAgent = req.get('User-Agent') || '';
      const ipAddress = req.ip || '';
      
      let riskScore = 0;

      // Check for suspicious user agents
      const suspiciousPatterns = [
        /curl/i, /wget/i, /python/i, /bot/i, /crawler/i, /spider/i,
        /automated/i, /script/i, /tool/i, /scanner/i, /exploit/i,
        /sqlmap/i, /nikto/i, /nmap/i, /burp/i
      ];

      if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
        riskScore += 60;
      }

      // Check for missing standard headers
      if (!req.get('Accept-Language')) riskScore += 10;
      if (!req.get('Accept-Encoding')) riskScore += 10;

      // Check user agent length
      if (userAgent.length < 20) riskScore += 20;
      if (userAgent.length > 500) riskScore += 15;

      const trusted = riskScore < 30;
      const isNewDevice = true; // Simplified - always treat as new for now

      if (riskScore > 50) {
        logger.warn('🚨 High-risk device detected', {
          userId,
          ipAddress: this.maskIP(ipAddress),
          userAgent: userAgent.substring(0, 100),
          riskScore
        });
      }

      return { trusted, isNewDevice, riskScore };
    } catch (error) {
      logger.error('❌ Device fingerprinting failed:', error);
      return { trusted: true, isNewDevice: false, riskScore: 0 }; // Fail safe
    }
  }

  /**
   * 3. API ABUSE DETECTION - Simple version
   */
  async checkAPIAbuse(req: Request, userId?: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const userAgent = req.get('User-Agent') || '';
      
      // Check for suspicious user agents
      const suspiciousPatterns = [
        /curl/i, /wget/i, /python/i, /bot/i, /crawler/i, /spider/i,
        /automated/i, /script/i, /tool/i, /scanner/i, /exploit/i,
        /sqlmap/i, /nikto/i, /nmap/i, /burp/i, /owasp/i
      ];

      if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
        logger.warn('🚨 API abuse detected', {
          ipAddress: this.maskIP(req.ip || ''),
          userAgent,
          endpoint: req.path,
          userId
        });

        return { 
          allowed: false, 
          reason: 'Automated requests detected. Please use the official application.' 
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('❌ API abuse check failed:', error);
      return { allowed: true }; // Fail open for safety
    }
  }

  /**
   * 4. GEOLOCATION ANOMALY - Placeholder
   */
  async checkGeolocationAnomaly(ipAddress: string, userId: string): Promise<{ suspicious: boolean; reason?: string }> {
    // Simplified version - just log for now
    logger.info('🌍 Geolocation check', {
      userId,
      ipAddress: this.maskIP(ipAddress)
    });
    
    return { suspicious: false };
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(): Promise<any> {
    return {
      totalThreats: this.failedAttempts.size,
      blockedThreats: Array.from(this.failedAttempts.values()).filter(a => a.blocked).length,
      criticalThreats: 0,
      threats24h: this.failedAttempts.size,
      failedAttempts: this.failedAttempts.size,
      deviceFingerprints: 0
    };
  }

  /**
   * Get recent security threats (simplified)
   */
  async getRecentSecurityThreats(limit: number = 50): Promise<any[]> {
    const threats = [];
    let id = 1;
    
    for (const [key, attempt] of this.failedAttempts.entries()) {
      if (attempt.blocked) {
        threats.push({
          id: `threat-${id++}`,
          type: key.startsWith('email:') ? 'BRUTE_FORCE_EMAIL' : 'BRUTE_FORCE_IP',
          severity: 'high',
          message: `Failed login attempts: ${attempt.count}`,
          timestamp: new Date(attempt.lastAttempt),
          blocked: true,
          details: { attemptCount: attempt.count }
        });
      }
      
      if (threats.length >= limit) break;
    }
    
    return threats;
  }

  /**
   * Cleanup expired data
   */
  async cleanup(): Promise<void> {
    try {
      const now = Date.now();
      const expiredTime = 24 * 60 * 60 * 1000; // 24 hours

      // Clean up failed attempts older than 24 hours
      for (const [key, value] of this.failedAttempts.entries()) {
        if (now - value.lastAttempt > expiredTime) {
          this.failedAttempts.delete(key);
        }
      }

      logger.info('✅ Security cleanup completed', {
        remainingEntries: this.failedAttempts.size
      });
    } catch (error) {
      logger.error('❌ Security cleanup failed:', error);
    }
  }

  /**
   * Reset all security limits (for testing purposes)
   */
  resetAllLimits(): void {
    try {
      const beforeCount = this.failedAttempts.size;
      this.failedAttempts.clear();
      
      logger.info('🧹 All security limits reset for testing', {
        clearedEntries: beforeCount,
        newState: 'clean slate'
      });
    } catch (error) {
      logger.error('❌ Failed to reset security limits:', error);
    }
  }

  /**
   * Utility functions
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    return `${local.substring(0, 2)}***@${domain}`;
  }

  private maskIP(ipAddress: string): string {
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    return ipAddress.substring(0, Math.max(0, ipAddress.length - 3)) + '***';
  }
}

export default SecurityEnhancementService;
