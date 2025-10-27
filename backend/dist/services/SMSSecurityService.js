"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSSecurityService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
class SMSSecurityService {
    constructor() {
        this.PREMIUM_PATTERNS = [
            /^1\d{3,4}$/,
            /^0900\d+$/,
            /^090\d+$/,
            /^\+1900\d+$/,
            /^\+3591\d{3,4}$/,
            /^18\d{2}$/,
            /^19\d{2}$/,
            /^0901\d+$/,
            /^0902\d+$/,
            /^0903\d+$/,
        ];
        this.EXTENDED_PREMIUM_PATTERNS = [
            /^0904\d+$/,
            /^0905\d+$/,
            /^0906\d+$/,
            /^0907\d+$/,
            /^0908\d+$/,
            /^0909\d+$/,
            /^\+359900\d+$/,
            /^\+359901\d+$/,
            /^\+359902\d+$/,
            /^\+359903\d+$/,
            /^\+359904\d+$/,
            /^\+359905\d+$/,
            /^\+359906\d+$/,
            /^\+359907\d+$/,
            /^\+359908\d+$/,
            /^\+359909\d+$/,
            /^1[0-9]{3,5}$/,
            /^\+1900\d+$/,
            /^\+1976\d+$/,
            /^\+44900\d+$/,
            /^\+49900\d+$/,
            /^\+33899\d+$/,
        ];
        this.SUSPICIOUS_NUMBER_CHARACTERISTICS = [
            /^[0-9]{1,4}$/,
            /^[0-9]{15,}$/,
            /^\*\d+$/,
            /^#\d+$/,
            /^\*\d+\*$/,
            /^#\d+#$/,
        ];
        this.SUSPICIOUS_CONTENT_PATTERNS = [
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
            /http[s]?:\/\/(?!192\.168\.0\.129)/i,
        ];
        this.rateLimitStore = new Map();
    }
    static getInstance() {
        if (!SMSSecurityService.instance) {
            SMSSecurityService.instance = new SMSSecurityService();
        }
        return SMSSecurityService.instance;
    }
    async validateSMSRequest(phoneNumber, message, userId, ipAddress) {
        try {
            logger_1.default.info('🔒 SMS Security Check Started', {
                phoneNumber: this.maskPhoneNumber(phoneNumber),
                userId,
                messageLength: message.length,
                ipAddress: ipAddress ? this.maskIP(ipAddress) : 'unknown'
            });
            const destinationCheck = this.analyzeDestination(phoneNumber);
            if (!destinationCheck.isAllowed) {
                logger_1.default.warn('🚨 SMS BLOCKED - Dangerous destination', {
                    phoneNumber: this.maskPhoneNumber(phoneNumber),
                    reason: destinationCheck.reason,
                    riskLevel: destinationCheck.riskLevel
                });
                return destinationCheck;
            }
            const contentCheck = this.analyzeMessageContent(message);
            if (!contentCheck.isAllowed) {
                logger_1.default.warn('🚨 SMS BLOCKED - Suspicious content', {
                    phoneNumber: this.maskPhoneNumber(phoneNumber),
                    reason: contentCheck.reason,
                    riskLevel: contentCheck.riskLevel
                });
                return contentCheck;
            }
            const rateLimitCheck = this.checkRateLimit(userId, ipAddress);
            if (!rateLimitCheck.isAllowed) {
                logger_1.default.warn('🚨 SMS BLOCKED - Rate limit exceeded', {
                    userId,
                    ipAddress: ipAddress ? this.maskIP(ipAddress) : 'unknown',
                    reason: rateLimitCheck.reason
                });
                return rateLimitCheck;
            }
            const behaviorCheck = await this.analyzeBehaviorPatterns(userId);
            if (!behaviorCheck.isAllowed) {
                logger_1.default.warn('🚨 SMS BLOCKED - Suspicious behavior', {
                    userId,
                    reason: behaviorCheck.reason,
                    riskLevel: behaviorCheck.riskLevel
                });
                return behaviorCheck;
            }
            logger_1.default.info('✅ SMS Security Check Passed', {
                phoneNumber: this.maskPhoneNumber(phoneNumber),
                userId,
                checks: ['destination', 'content', 'rateLimit', 'behavior']
            });
            return {
                isAllowed: true,
                riskLevel: 'low'
            };
        }
        catch (error) {
            logger_1.default.error('❌ SMS Security Check Failed', { error, phoneNumber: this.maskPhoneNumber(phoneNumber) });
            return {
                isAllowed: false,
                reason: 'Security check failed',
                riskLevel: 'critical',
                blockedReason: 'SECURITY_CHECK_ERROR'
            };
        }
    }
    analyzeDestination(phoneNumber) {
        const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        const isPremiumLayer1 = this.PREMIUM_PATTERNS.some(pattern => pattern.test(cleanNumber));
        if (isPremiumLayer1) {
            logger_1.default.warn('🚨 LAYER 1 BLOCK: Primary premium pattern detected', {
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
        const isPremiumLayer2 = this.EXTENDED_PREMIUM_PATTERNS.some(pattern => pattern.test(cleanNumber));
        if (isPremiumLayer2) {
            logger_1.default.warn('🚨 LAYER 2 BLOCK: Extended premium pattern detected', {
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
        const isSuspiciousLayer3 = this.SUSPICIOUS_NUMBER_CHARACTERISTICS.some(pattern => pattern.test(cleanNumber));
        if (isSuspiciousLayer3) {
            logger_1.default.warn('🚨 LAYER 3 BLOCK: Suspicious number characteristics detected', {
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
        const analysis = this.analyzePhoneNumber(phoneNumber);
        if (analysis.isInternational) {
            logger_1.default.info('⚠️ International SMS detected (passed all layers)', {
                phoneNumber: this.maskPhoneNumber(phoneNumber),
                countryCode: analysis.countryCode,
                riskScore: analysis.riskScore
            });
            if (analysis.riskScore > 7) {
                return {
                    isAllowed: false,
                    reason: 'High-risk international destination',
                    riskLevel: 'high',
                    blockedReason: 'HIGH_RISK_INTERNATIONAL'
                };
            }
        }
        logger_1.default.info('✅ Number passed all 3 security layers', {
            phoneNumber: this.maskPhoneNumber(phoneNumber),
            layers: ['PRIMARY_PREMIUM', 'EXTENDED_PREMIUM', 'SUSPICIOUS_CHARACTERISTICS'],
            finalRiskLevel: analysis.riskScore > 5 ? 'medium' : 'low'
        });
        return {
            isAllowed: true,
            riskLevel: analysis.riskScore > 5 ? 'medium' : 'low'
        };
    }
    analyzePhoneNumber(phoneNumber) {
        const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        const flags = [];
        let riskScore = 0;
        const isPremium = this.PREMIUM_PATTERNS.some(pattern => pattern.test(cleanNumber));
        if (isPremium) {
            flags.push('PREMIUM_NUMBER');
            riskScore += 10;
        }
        const isInternational = cleanNumber.startsWith('+') && !cleanNumber.startsWith('+359');
        let countryCode;
        if (isInternational) {
            flags.push('INTERNATIONAL');
            riskScore += 3;
            const match = cleanNumber.match(/^\+(\d{1,3})/);
            if (match) {
                countryCode = match[1];
                const highRiskCountries = ['1900', '900', '901', '902', '903'];
                if (highRiskCountries.includes(countryCode)) {
                    flags.push('HIGH_RISK_COUNTRY');
                    riskScore += 5;
                }
            }
        }
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
    analyzeMessageContent(message) {
        const flags = [];
        let riskScore = 0;
        for (const pattern of this.SUSPICIOUS_CONTENT_PATTERNS) {
            if (pattern.test(message)) {
                flags.push(`SUSPICIOUS_CONTENT: ${pattern.source}`);
                riskScore += 2;
            }
        }
        if (message.length > 500) {
            flags.push('LONG_MESSAGE');
            riskScore += 1;
        }
        const urlCount = (message.match(/http[s]?:\/\//g) || []).length;
        if (urlCount > 2) {
            flags.push('MULTIPLE_URLS');
            riskScore += 3;
        }
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
    checkRateLimit(userId, ipAddress) {
        const now = Date.now();
        const windowMs = 15 * 60 * 1000;
        const maxRequests = 10;
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
            }
            else {
                this.rateLimitStore.set(userKey, { count: 1, resetTime: now + windowMs });
            }
        }
        else {
            this.rateLimitStore.set(userKey, { count: 1, resetTime: now + windowMs });
        }
        if (ipAddress) {
            const ipKey = `ip:${ipAddress}`;
            const ipLimit = this.rateLimitStore.get(ipKey);
            if (ipLimit) {
                if (now < ipLimit.resetTime) {
                    if (ipLimit.count >= maxRequests * 2) {
                        return {
                            isAllowed: false,
                            reason: `IP rate limit exceeded: ${ipLimit.count}/${maxRequests * 2} requests in 15 minutes`,
                            riskLevel: 'medium',
                            blockedReason: 'RATE_LIMIT_IP'
                        };
                    }
                    ipLimit.count++;
                }
                else {
                    this.rateLimitStore.set(ipKey, { count: 1, resetTime: now + windowMs });
                }
            }
            else {
                this.rateLimitStore.set(ipKey, { count: 1, resetTime: now + windowMs });
            }
        }
        return { isAllowed: true, riskLevel: 'low' };
    }
    async analyzeBehaviorPatterns(userId) {
        return { isAllowed: true, riskLevel: 'low' };
    }
    maskPhoneNumber(phoneNumber) {
        if (phoneNumber.length <= 4)
            return '***';
        return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 2);
    }
    maskIP(ipAddress) {
        const parts = ipAddress.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
        }
        return ipAddress.substring(0, ipAddress.length - 3) + '***';
    }
    getSecurityStats() {
        return {
            rateLimitEntries: this.rateLimitStore.size,
            premiumPatterns: this.PREMIUM_PATTERNS.length,
            suspiciousPatterns: this.SUSPICIOUS_CONTENT_PATTERNS.length,
            lastCleanup: new Date().toISOString()
        };
    }
    cleanupRateLimits() {
        const now = Date.now();
        for (const [key, value] of this.rateLimitStore.entries()) {
            if (now >= value.resetTime) {
                this.rateLimitStore.delete(key);
            }
        }
    }
}
exports.SMSSecurityService = SMSSecurityService;
exports.default = SMSSecurityService;
//# sourceMappingURL=SMSSecurityService.js.map