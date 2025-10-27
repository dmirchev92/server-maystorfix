// Advanced Security Middleware
// Implements multiple layers of protection against sophisticated attacks

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
// import validator from 'validator';
import SecurityEnhancementService from '../services/SecurityEnhancementService';
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
 * 1. ADVANCED RATE LIMITING - Adaptive based on behavior
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
    keyGenerator: (req: Request) => {
      // Use combination of IP and User-Agent for better tracking
      return `${req.ip}-${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`;
    },
    handler: (req: Request, res: Response) => {
      logger.warn('🚨 Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method
      });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down.',
          retryAfter: Math.ceil(options.windowMs / 1000)
        }
      });
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * 2. PROGRESSIVE DELAY - Slow down suspicious requests
 */
export const progressiveDelay = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // Allow 5 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  keyGenerator: (req: Request) => `${req.ip}-${req.path}`
});

/**
 * 3. LOGIN SECURITY - Enhanced brute force protection
 */
export const loginSecurity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || 'unknown';
    
    // Simple email validation without validator dependency
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Valid email required' }
      });
    }

    const securityService = SecurityEnhancementService.getInstance();
    const bruteForceCheck = await securityService.checkBruteForceProtection(email, ipAddress);
    
    if (!bruteForceCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: bruteForceCheck.reason,
          retryAfter: bruteForceCheck.waitTime
        }
      });
    }

    next();
  } catch (error) {
    logger.error('❌ Login security check failed:', error);
    next(error);
  }
};

/**
 * 4. DEVICE FINGERPRINTING - Detect suspicious devices
 */
export const deviceFingerprinting = async (req: SecureRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();

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
      return res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_TRUSTED',
          message: 'This device is not trusted for administrative operations'
        }
      });
    }

    next();
  } catch (error) {
    logger.error('❌ Device fingerprinting failed:', error);
    next();
  }
};

/**
 * 5. GEOLOCATION SECURITY - Detect location anomalies
 */
export const geolocationSecurity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const ipAddress = req.ip || 'unknown';
    
    if (!userId) return next();

    const securityService = SecurityEnhancementService.getInstance();
    const geoCheck = await securityService.checkGeolocationAnomaly(ipAddress, userId);
    
    if (geoCheck.suspicious) {
      // Log but don't block - just add extra verification
      logger.warn('🌍 Geolocation anomaly detected', {
        userId,
        ipAddress,
        reason: geoCheck.reason
      });
      
      // Could add additional verification steps here
      // For now, just continue with warning
    }

    next();
  } catch (error) {
    logger.error('❌ Geolocation security check failed:', error);
    next();
  }
};

/**
 * 6. API ABUSE PROTECTION - Detect automated attacks
 */
export const apiAbuseProtection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const securityService = SecurityEnhancementService.getInstance();
    const abuseCheck = await securityService.checkAPIAbuse(req, req.user?.id);
    
    if (!abuseCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'API_ABUSE_DETECTED',
          message: abuseCheck.reason
        }
      });
    }

    next();
  } catch (error) {
    logger.error('❌ API abuse protection failed:', error);
    next();
  }
};

/**
 * 7. INPUT SANITIZATION - Prevent injection attacks
 */
export const inputSanitization = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize all string inputs
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        // Basic XSS protection
        return validator.escape(obj.trim());
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

    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    next();
  } catch (error) {
    logger.error('❌ Input sanitization failed:', error);
    next(error);
  }
};

/**
 * 8. SECURITY HEADERS - Enhanced protection
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
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

/**
 * 9. SUSPICIOUS ACTIVITY DETECTOR
 */
export const suspiciousActivityDetector = (req: Request, res: Response, next: NextFunction) => {
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

    return res.status(403).json({
      success: false,
      error: {
        code: 'SUSPICIOUS_ACTIVITY',
        message: 'Suspicious activity detected'
      }
    });
  }

  next();
};

/**
 * 10. ADMIN SECURITY - Extra protection for admin endpoints
 */
export const adminSecurity = [
  createAdaptiveRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 50 }),
  deviceFingerprinting,
  geolocationSecurity,
  (req: SecureRequest, res: Response, next: NextFunction) => {
    // Require trusted devices for admin operations
    if (req.securityContext && !req.securityContext.deviceTrusted) {
      logger.warn('🚨 Untrusted device attempting admin access', {
        userId: req.user?.id,
        riskScore: req.securityContext.riskScore,
        ipAddress: req.ip
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_VERIFICATION_REQUIRED',
          message: 'Device verification required for administrative access'
        }
      });
    }
    next();
  }
];

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
