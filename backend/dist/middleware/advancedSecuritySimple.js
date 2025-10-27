"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityEnhancementService = exports.rateLimits = exports.enhancedSecurityHeaders = exports.suspiciousActivityDetector = exports.inputSanitization = exports.apiAbuseProtection = exports.deviceFingerprinting = exports.loginSecurity = exports.createAdaptiveRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const SecurityEnhancementServiceSimple_1 = __importDefault(require("../services/SecurityEnhancementServiceSimple"));
exports.SecurityEnhancementService = SecurityEnhancementServiceSimple_1.default;
const logger_1 = __importDefault(require("../utils/logger"));
const createAdaptiveRateLimit = (options) => {
    return (0, express_rate_limit_1.default)({
        windowMs: options.windowMs,
        max: options.maxRequests,
        skipSuccessfulRequests: options.skipSuccessfulRequests || false,
        handler: (req, res) => {
            const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
            const availableAt = new Date(Date.now() + (retryAfterSeconds * 1000));
            const timeString = availableAt.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            });
            logger_1.default.warn('🚨 Rate limit exceeded', {
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
exports.createAdaptiveRateLimit = createAdaptiveRateLimit;
const loginSecurity = async (req, res, next) => {
    try {
        const { email } = req.body;
        const ipAddress = req.ip || 'unknown';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            res.status(400).json({
                success: false,
                error: { code: 'INVALID_EMAIL', message: 'Valid email required' }
            });
            return;
        }
        const securityService = SecurityEnhancementServiceSimple_1.default.getInstance();
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
    }
    catch (error) {
        logger_1.default.error('❌ Login security check failed:', error);
        next(error);
    }
};
exports.loginSecurity = loginSecurity;
const deviceFingerprinting = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            next();
            return;
        }
        const securityService = SecurityEnhancementServiceSimple_1.default.getInstance();
        const deviceAnalysis = await securityService.analyzeDeviceFingerprint(req, userId);
        req.securityContext = {
            riskScore: deviceAnalysis.riskScore,
            deviceTrusted: deviceAnalysis.trusted,
            isNewDevice: deviceAnalysis.isNewDevice,
            threatLevel: deviceAnalysis.riskScore > 70 ? 'critical' :
                deviceAnalysis.riskScore > 50 ? 'high' :
                    deviceAnalysis.riskScore > 30 ? 'medium' : 'low'
        };
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
    }
    catch (error) {
        logger_1.default.error('❌ Device fingerprinting failed:', error);
        next();
    }
};
exports.deviceFingerprinting = deviceFingerprinting;
const apiAbuseProtection = async (req, res, next) => {
    try {
        const securityService = SecurityEnhancementServiceSimple_1.default.getInstance();
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
    }
    catch (error) {
        logger_1.default.error('❌ API abuse protection failed:', error);
        next();
    }
};
exports.apiAbuseProtection = apiAbuseProtection;
const inputSanitization = (req, res, next) => {
    try {
        const escapeHtml = (text) => {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, (m) => map[m]);
        };
        const sanitizeObject = (obj) => {
            if (typeof obj === 'string') {
                return escapeHtml(obj.trim());
            }
            else if (Array.isArray(obj)) {
                return obj.map(sanitizeObject);
            }
            else if (obj && typeof obj === 'object') {
                const sanitized = {};
                for (const [key, value] of Object.entries(obj)) {
                    sanitized[key] = sanitizeObject(value);
                }
                return sanitized;
            }
            return obj;
        };
        if (req.body && typeof req.body === 'object') {
            try {
                req.body = sanitizeObject(req.body);
            }
            catch (error) {
                logger_1.default.warn('⚠️ Could not sanitize request body:', error);
            }
        }
        next();
    }
    catch (error) {
        logger_1.default.error('❌ Input sanitization failed:', error);
        next(error);
    }
};
exports.inputSanitization = inputSanitization;
const suspiciousActivityDetector = (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = req.ip || 'unknown';
    const suspiciousPatterns = [
        /sqlmap/i, /nikto/i, /nmap/i, /burp/i, /owasp/i,
        /hack/i, /exploit/i, /injection/i, /xss/i, /csrf/i,
        /<script/i, /javascript:/i, /vbscript:/i, /onload=/i,
        /union.*select/i, /drop.*table/i, /insert.*into/i
    ];
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent) ||
        pattern.test(req.url) ||
        pattern.test(JSON.stringify(req.body || {})));
    if (isSuspicious) {
        logger_1.default.warn('🚨 Suspicious activity detected', {
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
exports.suspiciousActivityDetector = suspiciousActivityDetector;
exports.enhancedSecurityHeaders = (0, helmet_1.default)({
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
        maxAge: 31536000,
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
exports.rateLimits = {
    auth: (0, exports.createAdaptiveRateLimit)({
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
        skipSuccessfulRequests: true
    }),
    sms: (0, exports.createAdaptiveRateLimit)({
        windowMs: 15 * 60 * 1000,
        maxRequests: 10
    }),
    general: (0, exports.createAdaptiveRateLimit)({
        windowMs: 15 * 60 * 1000,
        maxRequests: 100
    }),
    admin: (0, exports.createAdaptiveRateLimit)({
        windowMs: 15 * 60 * 1000,
        maxRequests: 50
    })
};
//# sourceMappingURL=advancedSecuritySimple.js.map