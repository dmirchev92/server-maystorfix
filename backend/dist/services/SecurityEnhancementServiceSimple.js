"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityEnhancementService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
class SecurityEnhancementService {
    static getInstance() {
        if (!SecurityEnhancementService.instance) {
            SecurityEnhancementService.instance = new SecurityEnhancementService();
        }
        return SecurityEnhancementService.instance;
    }
    constructor() {
        this.failedAttempts = new Map();
        logger_1.default.info('✅ Security Enhancement Service initialized');
    }
    async checkBruteForceProtection(email, ipAddress) {
        try {
            const emailKey = `email:${email}`;
            const ipKey = `ip:${ipAddress}`;
            const now = Date.now();
            const emailWindowMs = 15 * 60 * 1000;
            const ipWindowMs = 60 * 60 * 1000;
            const emailMaxAttempts = 5;
            const ipMaxAttempts = 20;
            const emailRecord = this.failedAttempts.get(emailKey);
            const ipRecord = this.failedAttempts.get(ipKey);
            const currentEmailAttempts = emailRecord?.count || 0;
            const currentIpAttempts = ipRecord?.count || 0;
            const emailRemaining = Math.max(0, emailMaxAttempts - currentEmailAttempts);
            const ipRemaining = Math.max(0, ipMaxAttempts - currentIpAttempts);
            if (emailRecord && emailRecord.blocked && (now - emailRecord.lastAttempt) < emailWindowMs) {
                const waitTime = Math.ceil((emailWindowMs - (now - emailRecord.lastAttempt)) / 1000);
                const availableAt = new Date(now + waitTime * 1000);
                const timeString = availableAt.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                });
                logger_1.default.warn('🚨 Brute force protection: Email account locked', {
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
            if (ipRecord && ipRecord.blocked && (now - ipRecord.lastAttempt) < ipWindowMs) {
                const waitTime = Math.ceil((ipWindowMs - (now - ipRecord.lastAttempt)) / 1000);
                const availableAt = new Date(now + waitTime * 1000);
                const timeString = availableAt.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                });
                logger_1.default.warn('🚨 Brute force protection: IP temporarily restricted', {
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
        }
        catch (error) {
            logger_1.default.error('❌ Brute force check failed:', error);
            return { allowed: true };
        }
    }
    recordFailedLogin(email, ipAddress) {
        try {
            const emailKey = `email:${email}`;
            const ipKey = `ip:${ipAddress}`;
            const now = Date.now();
            const emailMaxAttempts = 5;
            const ipMaxAttempts = 20;
            const emailAttempts = this.failedAttempts.get(emailKey) || { count: 0, lastAttempt: 0, blocked: false };
            emailAttempts.count++;
            emailAttempts.lastAttempt = now;
            emailAttempts.blocked = emailAttempts.count >= emailMaxAttempts;
            this.failedAttempts.set(emailKey, emailAttempts);
            const ipAttempts = this.failedAttempts.get(ipKey) || { count: 0, lastAttempt: 0, blocked: false };
            ipAttempts.count++;
            ipAttempts.lastAttempt = now;
            ipAttempts.blocked = ipAttempts.count >= ipMaxAttempts;
            this.failedAttempts.set(ipKey, ipAttempts);
            const logLevel = emailAttempts.blocked ? 'error' : 'warn';
            const message = emailAttempts.blocked ?
                '🔒 Account locked due to failed attempts' :
                '⚠️ Failed login attempt recorded';
            logger_1.default[logLevel](message, {
                email: this.maskEmail(email),
                ipAddress: this.maskIP(ipAddress),
                emailAttempts: emailAttempts.count,
                ipAttempts: ipAttempts.count,
                emailBlocked: emailAttempts.blocked,
                ipBlocked: ipAttempts.blocked,
                nextAction: emailAttempts.blocked ? 'Account locked for 15 minutes' :
                    ipAttempts.blocked ? 'IP restricted for 1 hour' : 'Continue monitoring'
            });
        }
        catch (error) {
            logger_1.default.error('❌ Failed to record failed login:', error);
        }
    }
    clearFailedAttempts(email, ipAddress) {
        try {
            this.failedAttempts.delete(`email:${email}`);
            this.failedAttempts.delete(`ip:${ipAddress}`);
            logger_1.default.info('✅ Failed attempts cleared', {
                email: this.maskEmail(email),
                ipAddress: this.maskIP(ipAddress)
            });
        }
        catch (error) {
            logger_1.default.error('❌ Failed to clear attempts:', error);
        }
    }
    async analyzeDeviceFingerprint(req, userId) {
        try {
            const userAgent = req.get('User-Agent') || '';
            const ipAddress = req.ip || '';
            let riskScore = 0;
            const suspiciousPatterns = [
                /curl/i, /wget/i, /python/i, /bot/i, /crawler/i, /spider/i,
                /automated/i, /script/i, /tool/i, /scanner/i, /exploit/i,
                /sqlmap/i, /nikto/i, /nmap/i, /burp/i
            ];
            if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
                riskScore += 60;
            }
            if (!req.get('Accept-Language'))
                riskScore += 10;
            if (!req.get('Accept-Encoding'))
                riskScore += 10;
            if (userAgent.length < 20)
                riskScore += 20;
            if (userAgent.length > 500)
                riskScore += 15;
            const trusted = riskScore < 30;
            const isNewDevice = true;
            if (riskScore > 50) {
                logger_1.default.warn('🚨 High-risk device detected', {
                    userId,
                    ipAddress: this.maskIP(ipAddress),
                    userAgent: userAgent.substring(0, 100),
                    riskScore
                });
            }
            return { trusted, isNewDevice, riskScore };
        }
        catch (error) {
            logger_1.default.error('❌ Device fingerprinting failed:', error);
            return { trusted: true, isNewDevice: false, riskScore: 0 };
        }
    }
    async checkAPIAbuse(req, userId) {
        try {
            const userAgent = req.get('User-Agent') || '';
            const suspiciousPatterns = [
                /curl/i, /wget/i, /python/i, /bot/i, /crawler/i, /spider/i,
                /automated/i, /script/i, /tool/i, /scanner/i, /exploit/i,
                /sqlmap/i, /nikto/i, /nmap/i, /burp/i, /owasp/i
            ];
            if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
                logger_1.default.warn('🚨 API abuse detected', {
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
        }
        catch (error) {
            logger_1.default.error('❌ API abuse check failed:', error);
            return { allowed: true };
        }
    }
    async checkGeolocationAnomaly(ipAddress, userId) {
        logger_1.default.info('🌍 Geolocation check', {
            userId,
            ipAddress: this.maskIP(ipAddress)
        });
        return { suspicious: false };
    }
    async getSecurityStats() {
        return {
            totalThreats: this.failedAttempts.size,
            blockedThreats: Array.from(this.failedAttempts.values()).filter(a => a.blocked).length,
            criticalThreats: 0,
            threats24h: this.failedAttempts.size,
            failedAttempts: this.failedAttempts.size,
            deviceFingerprints: 0
        };
    }
    async getRecentSecurityThreats(limit = 50) {
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
            if (threats.length >= limit)
                break;
        }
        return threats;
    }
    async cleanup() {
        try {
            const now = Date.now();
            const expiredTime = 24 * 60 * 60 * 1000;
            for (const [key, value] of this.failedAttempts.entries()) {
                if (now - value.lastAttempt > expiredTime) {
                    this.failedAttempts.delete(key);
                }
            }
            logger_1.default.info('✅ Security cleanup completed', {
                remainingEntries: this.failedAttempts.size
            });
        }
        catch (error) {
            logger_1.default.error('❌ Security cleanup failed:', error);
        }
    }
    resetAllLimits() {
        try {
            const beforeCount = this.failedAttempts.size;
            this.failedAttempts.clear();
            logger_1.default.info('🧹 All security limits reset for testing', {
                clearedEntries: beforeCount,
                newState: 'clean slate'
            });
        }
        catch (error) {
            logger_1.default.error('❌ Failed to reset security limits:', error);
        }
    }
    maskEmail(email) {
        const [local, domain] = email.split('@');
        if (!domain)
            return '***@***';
        return `${local.substring(0, 2)}***@${domain}`;
    }
    maskIP(ipAddress) {
        const parts = ipAddress.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
        }
        return ipAddress.substring(0, Math.max(0, ipAddress.length - 3)) + '***';
    }
}
exports.SecurityEnhancementService = SecurityEnhancementService;
exports.default = SecurityEnhancementService;
//# sourceMappingURL=SecurityEnhancementServiceSimple.js.map