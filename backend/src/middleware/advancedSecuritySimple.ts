// Simplified Advanced Security Middleware (No External Dependencies)
// Implements core security layers without compilation issues

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import SecurityEnhancementService from '../services/SecurityEnhancementServiceSimple';
import logger from '../utils/logger';

export interface SecureRequest extends Request {
  securityContext?: {
    riskScore: number;
    deviceTrusted: boolean;
    isNewDevice: boolean;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

/**
 * 1. ENHANCED RATE LIMITING - Adaptive based on behavior
 */
export const createAdaptiveRateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.maxRequests,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    // Remove custom keyGenerator to use default IPv6-safe implementation
    // keyGenerator: (req: Request) => {
    //   return `${req.ip}-${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`;
    // },
    handler: (req: Request, res: Response) => {
      const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
      const availableAt = new Date(Date.now() + (retryAfterSeconds * 1000));
      const timeString = availableAt.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      logger.warn('🚨 Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method,
        availableAt: timeString
      });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many login attempts. Please try again at ${timeString}.`,
          retryAfter: retryAfterSeconds,
          availableAt: availableAt.toISOString(),
          availableAtLocal: timeString
        }
      });
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * 2. LOGIN SECURITY - Enhanced brute force protection
 */
export const loginSecurity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || 'unknown';
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Valid email required' }
      });
      return;
    }

    const securityService = SecurityEnhancementService.getInstance();
    const bruteForceCheck = await securityService.checkBruteForceProtection(email, ipAddress);
    
    if (!bruteForceCheck.allowed) {
      res.status(429).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: bruteForceCheck.reason,
          retryAfter: bruteForceCheck.waitTime
        }
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('❌ Login security check failed:', error);
    next(error);
  }
};

/**
 * 3. DEVICE FINGERPRINTING - Detect suspicious devices
 */
export const deviceFingerprinting = async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next();
      return;
    }

    const securityService = SecurityEnhancementService.getInstance();
    const deviceAnalysis = await securityService.analyzeDeviceFingerprint(req, userId);
    
    req.securityContext = {
      riskScore: deviceAnalysis.riskScore,
      deviceTrusted: deviceAnalysis.trusted,
      isNewDevice: deviceAnalysis.isNewDevice,
      threatLevel: deviceAnalysis.riskScore > 70 ? 'critical' : 
                   deviceAnalysis.riskScore > 50 ? 'high' :
                   deviceAnalysis.riskScore > 30 ? 'medium' : 'low'
    };

    // Block high-risk devices from sensitive operations
    if (deviceAnalysis.riskScore > 80 && req.path.includes('/admin')) {
      res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_TRUSTED',
          message: 'This device is not trusted for administrative operations'
        }
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('❌ Device fingerprinting failed:', error);
    next();
  }
};

/**
 * 4. API ABUSE PROTECTION - Detect automated attacks
 */
export const apiAbuseProtection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const securityService = SecurityEnhancementService.getInstance();
    const abuseCheck = await securityService.checkAPIAbuse(req, req.user?.id);
    
    if (!abuseCheck.allowed) {
      res.status(403).json({
        success: false,
        error: {
          code: 'API_ABUSE_DETECTED',
          message: abuseCheck.reason
        }
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('❌ API abuse protection failed:', error);
    next();
  }
};

/**
 * 5. INPUT SANITIZATION - Prevent injection attacks
 */
export const inputSanitization = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Basic HTML escape function
    const escapeHtml = (text: string): string => {
      const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, (m) => map[m]);
    };

    // Sanitize all string inputs
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return escapeHtml(obj.trim());
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };

    // Sanitize request body (only if it exists and is modifiable)
    if (req.body && typeof req.body === 'object') {
      try {
        req.body = sanitizeObject(req.body);
      } catch (error) {
        logger.warn('⚠️ Could not sanitize request body:', error);
      }
    }

    // Note: req.query is read-only in Express, so we skip sanitizing it
    // Query parameters are typically sanitized by express-validator if needed

    next();
  } catch (error) {
    logger.error('❌ Input sanitization failed:', error);
    next(error);
  }
};

/**
 * 6. SUSPICIOUS ACTIVITY DETECTOR
 */
export const suspiciousActivityDetector = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = req.ip || 'unknown';
  
  // Detect suspicious patterns
  const suspiciousPatterns = [
    /sqlmap/i, /nikto/i, /nmap/i, /burp/i, /owasp/i,
    /hack/i, /exploit/i, /injection/i, /xss/i, /csrf/i,
    /<script/i, /javascript:/i, /vbscript:/i, /onload=/i,
    /union.*select/i, /drop.*table/i, /insert.*into/i
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(userAgent) || 
    pattern.test(req.url) || 
    pattern.test(JSON.stringify(req.body || {}))
  );

  if (isSuspicious) {
    logger.warn('🚨 Suspicious activity detected', {
      ipAddress,
      userAgent,
      url: req.url,
      method: req.method,
      body: req.body
    });

    res.status(403).json({
      success: false,
      error: {
        code: 'SUSPICIOUS_ACTIVITY',
        message: 'Suspicious activity detected'
      }
    });
    return;
  }

  next();
};

/**
 * 7. ENHANCED SECURITY HEADERS
 */
export const enhancedSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

/**
 * Rate limiting configurations for different endpoints
 */
export const rateLimits = {
  // Very strict for authentication
  auth: createAdaptiveRateLimit({ 
    windowMs: 15 * 60 * 1000, 
    maxRequests: 5,
    skipSuccessfulRequests: true 
  }),
  
  // Moderate for SMS sending
  sms: createAdaptiveRateLimit({ 
    windowMs: 15 * 60 * 1000, 
    maxRequests: 10 
  }),
  
  // Lenient for general API
  general: createAdaptiveRateLimit({ 
    windowMs: 15 * 60 * 1000, 
    maxRequests: 100 
  }),
  
  // Very strict for admin
  admin: createAdaptiveRateLimit({ 
    windowMs: 15 * 60 * 1000, 
    maxRequests: 50 
  })
};

export {
  SecurityEnhancementService
};
