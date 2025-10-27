"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequestLogger = exports.logError = exports.createServiceLogger = exports.gdprLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};
const sanitizeFormat = winston_1.default.format((info) => {
    const sensitiveFields = [
        'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
        'phoneNumber', 'email', 'firstName', 'lastName', 'address',
        'eik', 'ddsNumber', 'personalData'
    ];
    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        const sanitized = { ...obj };
        for (const field of sensitiveFields) {
            if (field in sanitized) {
                if (field === 'phoneNumber' || field === 'email') {
                    const value = sanitized[field];
                    if (typeof value === 'string') {
                        if (field === 'phoneNumber') {
                            sanitized[field] = value.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');
                        }
                        else if (field === 'email') {
                            sanitized[field] = value.replace(/(.{2}).*(@.*)/, '$1****$2');
                        }
                    }
                }
                else {
                    sanitized[field] = '[REDACTED]';
                }
            }
        }
        for (const key in sanitized) {
            if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
                sanitized[key] = sanitizeObject(sanitized[key]);
            }
        }
        return sanitized;
    };
    if (typeof info.message === 'object') {
        info.message = sanitizeObject(info.message);
    }
    const { level, message, timestamp, ...meta } = info;
    const sanitizedMeta = sanitizeObject(meta);
    return {
        level,
        message,
        timestamp,
        ...sanitizedMeta
    };
});
const logger = winston_1.default.createLogger({
    levels: logLevels,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }), sanitizeFormat(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: {
        service: 'servicetext-pro-backend',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(process.cwd(), 'logs', 'error.log'),
            level: 'warn',
            maxsize: 5242880,
            maxFiles: 10,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(process.cwd(), 'logs', 'combined.log'),
            maxsize: 5242880,
            maxFiles: 20,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(process.cwd(), 'logs', 'gdpr-audit.log'),
            level: 'info',
            maxsize: 10485760,
            maxFiles: 50,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
                return JSON.stringify({
                    timestamp,
                    level,
                    message,
                    gdprRelevant: true,
                    retentionUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
                    ...meta
                });
            }))
        })
    ],
    exitOnError: false
});
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
        }))
    }));
}
exports.gdprLogger = {
    logDataAccess: (userId, dataType, purpose, ipAddress) => {
        logger.info('Data access event', {
            event: 'DATA_ACCESS',
            userId,
            dataType,
            purpose,
            ipAddress: ipAddress?.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.***'),
            gdprRelevant: true,
            legalBasis: 'legitimate_interest',
            timestamp: new Date().toISOString()
        });
    },
    logConsentChange: (userId, consentType, granted, ipAddress) => {
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
    logDataRetention: (dataType, action, recordCount) => {
        logger.info('Data retention event', {
            event: 'DATA_RETENTION',
            dataType,
            action,
            recordCount,
            gdprRelevant: true,
            timestamp: new Date().toISOString()
        });
    },
    logPrivacyRightRequest: (userId, rightType, status) => {
        logger.info('Privacy right request', {
            event: 'PRIVACY_RIGHT_REQUEST',
            userId,
            rightType,
            status,
            gdprRelevant: true,
            timestamp: new Date().toISOString()
        });
    },
    logDataBreach: (severity, description, affectedUsers) => {
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
exports.default = logger;
const createServiceLogger = (serviceName) => {
    return logger.child({
        service: `servicetext-pro-${serviceName}`,
        component: serviceName
    });
};
exports.createServiceLogger = createServiceLogger;
const logError = (error, context) => {
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
exports.logError = logError;
const createRequestLogger = () => {
    return (req, res, next) => {
        const startTime = Date.now();
        logger.http('Incoming request', {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip?.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.***'),
            userId: req.user?.id || 'anonymous',
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        const originalSend = res.send;
        res.send = function (data) {
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
exports.createRequestLogger = createRequestLogger;
//# sourceMappingURL=logger.js.map