// GDPR-compliant logging utility
// Ensures no PII is logged and provides audit trail functionality

import winston from 'winston';
import path from 'path';

// Define log levels with GDPR compliance in mind
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Custom format that sanitizes potential PII
const sanitizeFormat = winston.format((info) => {
  // Remove or mask potential PII fields
  const sensitiveFields = [
    'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
    'phoneNumber', 'email', 'firstName', 'lastName', 'address',
    'eik', 'ddsNumber', 'personalData'
  ];

  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized = { ...obj };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        if (field === 'phoneNumber' || field === 'email') {
          // Partially mask phone numbers and emails for debugging
          const value = sanitized[field];
          if (typeof value === 'string') {
            if (field === 'phoneNumber') {
              sanitized[field] = value.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');
            } else if (field === 'email') {
              sanitized[field] = value.replace(/(.{2}).*(@.*)/, '$1****$2');
            }
          }
        } else {
          sanitized[field] = '[REDACTED]';
        }
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeObject(sanitized[key]);
      }
    }

    return sanitized;
  };

  // Sanitize the log message and metadata
  if (typeof info.message === 'object') {
    info.message = sanitizeObject(info.message);
  }

  // Sanitize any additional metadata
  const { level, message, timestamp, ...meta } = info;
  const sanitizedMeta = sanitizeObject(meta);

  return {
    level,
    message,
    timestamp,
    ...sanitizedMeta
  };
});

// Create the logger instance
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    sanitizeFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'servicetext-pro-backend',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file - only errors and warnings
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // Combined log file - all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 20,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // GDPR audit log - special handling for compliance
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'gdpr-audit.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 50, // Keep longer for compliance (7 years retention)
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            gdprRelevant: true,
            retentionUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
            ...meta
          });
        })
      )
    })
  ],
  exitOnError: false
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    )
  }));
}

// GDPR-compliant logging functions
export const gdprLogger = {
  // Log data access events (GDPR Article 30)
  logDataAccess: (userId: string, dataType: string, purpose: string, ipAddress?: string) => {
    logger.info('Data access event', {
      event: 'DATA_ACCESS',
      userId,
      dataType,
      purpose,
      ipAddress: ipAddress?.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.***'), // Mask last octet
      gdprRelevant: true,
      legalBasis: 'legitimate_interest',
      timestamp: new Date().toISOString()
    });
  },

  // Log consent changes
  logConsentChange: (userId: string, consentType: string, granted: boolean, ipAddress?: string) => {
    logger.info('Consent change event', {
      event: 'CONSENT_CHANGE',
      userId,
      consentType,
      granted,
      ipAddress: ipAddress?.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.***'),
      gdprRelevant: true,
      timestamp: new Date().toISOString()
    });
  },

  // Log data retention events
  logDataRetention: (dataType: string, action: 'CREATED' | 'UPDATED' | 'DELETED', recordCount: number) => {
    logger.info('Data retention event', {
      event: 'DATA_RETENTION',
      dataType,
      action,
      recordCount,
      gdprRelevant: true,
      timestamp: new Date().toISOString()
    });
  },

  // Log privacy rights requests (access, rectification, erasure, etc.)
  logPrivacyRightRequest: (userId: string, rightType: string, status: string) => {
    logger.info('Privacy right request', {
      event: 'PRIVACY_RIGHT_REQUEST',
      userId,
      rightType,
      status,
      gdprRelevant: true,
      timestamp: new Date().toISOString()
    });
  },

  // Log data breaches (must be reported within 72 hours)
  logDataBreach: (severity: 'LOW' | 'MEDIUM' | 'HIGH', description: string, affectedUsers?: number) => {
    logger.error('Data breach detected', {
      event: 'DATA_BREACH',
      severity,
      description,
      affectedUsers,
      gdprRelevant: true,
      requiresNotification: severity === 'HIGH',
      timestamp: new Date().toISOString(),
      alertLevel: 'CRITICAL'
    });
  }
};

// Export the main logger
export default logger;

// Helper function to create child loggers for specific services
export const createServiceLogger = (serviceName: string) => {
  return logger.child({
    service: `servicetext-pro-${serviceName}`,
    component: serviceName
  });
};

// Error logging helper that doesn't expose sensitive information
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error('Application error', {
    error: {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    },
    context: context,
    timestamp: new Date().toISOString()
  });
};

// Request logging middleware helper
export const createRequestLogger = () => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Log request (without sensitive data)
    logger.http('Incoming request', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip?.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.***'), // Mask IP
      userId: req.user?.id || 'anonymous',
      requestId: req.headers['x-request-id'] || 'unknown'
    });

    // Log response
    const originalSend = res.send;
    res.send = function(data: any) {
      const duration = Date.now() - startTime;
      
      logger.http('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userId: req.user?.id || 'anonymous',
        requestId: req.headers['x-request-id'] || 'unknown'
      });

      return originalSend.call(this, data);
    };

    next();
  };
};
