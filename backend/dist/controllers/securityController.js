"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRealtimeMetrics = exports.cleanupSecurity = exports.getSecurityConfig = exports.testSMSSecurity = exports.getSecurityAlerts = exports.getSecurityDashboard = exports.SecurityController = void 0;
const SecurityEnhancementService_1 = __importDefault(require("../services/SecurityEnhancementService"));
const SMSSecurityService_1 = __importDefault(require("../services/SMSSecurityService"));
const logger_1 = __importDefault(require("../utils/logger"));
const rbac_1 = require("../middleware/rbac");
class SecurityController {
    constructor() {
        this.securityService = SecurityEnhancementService_1.default.getInstance();
        this.smsSecurityService = SMSSecurityService_1.default.getInstance();
    }
    async getSecurityDashboard(req, res, next) {
        try {
            logger_1.default.info('📊 Admin accessing security dashboard', {
                adminId: req.user?.id,
                ipAddress: req.ip
            });
            const [securityStats, smsStats, recentThreats] = await Promise.all([
                this.securityService.getSecurityStats(),
                this.smsSecurityService.getSecurityStats(),
                this.securityService.getRecentSecurityThreats(20)
            ]);
            const threatTrends = this.calculateThreatTrends(recentThreats);
            const systemHealth = await this.getSystemHealthMetrics();
            const dashboardData = {
                overview: {
                    totalThreats: securityStats.totalThreats,
                    blockedThreats: securityStats.blockedThreats,
                    criticalThreats: securityStats.criticalThreats,
                    threats24h: securityStats.threats24h,
                    smsBlocked: smsStats.rateLimitEntries || 0,
                    systemHealth: systemHealth.status
                },
                smsProtection: {
                    premiumPatternsActive: smsStats.premiumPatterns,
                    suspiciousPatternsActive: smsStats.suspiciousPatterns,
                    lastCleanup: smsStats.lastCleanup,
                    protectionLayers: 3
                },
                recentThreats: recentThreats.map(threat => ({
                    id: threat.id,
                    type: threat.type,
                    severity: threat.severity,
                    timestamp: threat.timestamp,
                    ipAddress: this.maskIP(threat.ipAddress),
                    blocked: threat.blocked,
                    details: threat.details
                })),
                threatTrends,
                systemMetrics: {
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                    cpuUsage: process.cpuUsage(),
                    activeConnections: securityStats.failedAttempts,
                    deviceFingerprints: securityStats.deviceFingerprints
                }
            };
            res.json({
                success: true,
                data: dashboardData,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger_1.default.error('❌ Security dashboard error:', error);
            next(error);
        }
    }
    async getSecurityAlerts(req, res, next) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const severity = req.query.severity;
            const type = req.query.type;
            const threats = await this.securityService.getRecentSecurityThreats(limit);
            let filteredThreats = threats;
            if (severity) {
                filteredThreats = filteredThreats.filter(t => t.severity === severity);
            }
            if (type) {
                filteredThreats = filteredThreats.filter(t => t.type === type);
            }
            const alerts = filteredThreats.map(threat => ({
                id: threat.id,
                type: threat.type,
                severity: threat.severity,
                message: this.formatThreatMessage(threat),
                timestamp: threat.timestamp,
                ipAddress: this.maskIP(threat.ipAddress),
                userId: threat.userId,
                blocked: threat.blocked,
                details: threat.details,
                actionTaken: threat.blocked ? 'BLOCKED' : 'LOGGED'
            }));
            res.json({
                success: true,
                data: {
                    alerts,
                    total: alerts.length,
                    filters: { severity, type, limit }
                }
            });
        }
        catch (error) {
            logger_1.default.error('❌ Security alerts error:', error);
            next(error);
        }
    }
    async testSMSSecurity(req, res, next) {
        try {
            const { phoneNumber, message } = req.body;
            const userId = req.user?.id || 'admin-test';
            const ipAddress = req.ip || 'unknown';
            logger_1.default.info('🧪 Admin testing SMS security', {
                adminId: req.user?.id,
                testNumber: phoneNumber,
                ipAddress
            });
            const securityCheck = await this.smsSecurityService.validateSMSRequest(phoneNumber || '0900123456', message || 'Test premium number blocking', userId, ipAddress);
            const testResult = {
                testType: 'SMS_SECURITY_TEST',
                phoneNumber: phoneNumber || '0900123456',
                allowed: securityCheck.isAllowed,
                riskLevel: securityCheck.riskLevel,
                reason: securityCheck.reason,
                blockedReason: securityCheck.blockedReason,
                timestamp: new Date().toISOString(),
                adminId: req.user?.id
            };
            logger_1.default.info('🧪 SMS security test completed', testResult);
            res.json({
                success: true,
                data: {
                    testResult: {
                        allowed: securityCheck.isAllowed,
                        riskLevel: securityCheck.riskLevel,
                        reason: securityCheck.reason || 'SMS would be allowed',
                        blockedReason: securityCheck.blockedReason,
                        message: securityCheck.isAllowed
                            ? '✅ SMS Security Test: Message would be ALLOWED (this might indicate a security gap)'
                            : '🚫 SMS Security Test: Message was BLOCKED (security working correctly)'
                    },
                    securityLayers: {
                        layer1: 'Premium Number Detection',
                        layer2: 'Extended Premium Patterns',
                        layer3: 'Suspicious Characteristics',
                        contentAnalysis: 'Message Content Scanning',
                        rateLimiting: 'User & IP Rate Limits'
                    }
                }
            });
        }
        catch (error) {
            logger_1.default.error('❌ SMS security test error:', error);
            next(error);
        }
    }
    async getSecurityConfig(req, res, next) {
        try {
            const config = {
                smsProtection: {
                    premiumPatterns: 10,
                    extendedPatterns: 15,
                    suspiciousPatterns: 6,
                    contentFilters: 14,
                    rateLimiting: {
                        maxSMSPer15Min: 10,
                        maxLoginAttempts: 5,
                        bruteForceWindow: '15 minutes'
                    }
                },
                authentication: {
                    bcryptRounds: 12,
                    jwtExpiration: '24 hours',
                    refreshTokenExpiration: '7 days',
                    deviceFingerprintingEnabled: true,
                    geolocationMonitoring: true
                },
                apiSecurity: {
                    rateLimitingEnabled: true,
                    inputSanitization: true,
                    xssProtection: true,
                    sqlInjectionProtection: true,
                    csrfProtection: true
                },
                monitoring: {
                    threatDetection: true,
                    behaviorAnalysis: true,
                    realTimeAlerts: true,
                    securityLogging: true
                }
            };
            res.json({
                success: true,
                data: config
            });
        }
        catch (error) {
            logger_1.default.error('❌ Security config error:', error);
            next(error);
        }
    }
    async cleanupSecurity(req, res, next) {
        try {
            logger_1.default.info('🧹 Admin triggered security cleanup', {
                adminId: req.user?.id,
                ipAddress: req.ip
            });
            await this.securityService.cleanup();
            this.smsSecurityService.cleanupRateLimits();
            res.json({
                success: true,
                data: {
                    message: 'Security system cleanup completed',
                    timestamp: new Date().toISOString(),
                    actions: [
                        'Expired rate limits cleared',
                        'Old security threats archived',
                        'Device fingerprints updated',
                        'Failed login attempts reset'
                    ]
                }
            });
        }
        catch (error) {
            logger_1.default.error('❌ Security cleanup error:', error);
            next(error);
        }
    }
    async getRealtimeMetrics(req, res, next) {
        try {
            const metrics = {
                timestamp: new Date().toISOString(),
                activeThreats: 0,
                blockedRequests: 0,
                suspiciousActivity: 0,
                systemLoad: {
                    cpu: process.cpuUsage(),
                    memory: process.memoryUsage(),
                    uptime: process.uptime()
                },
                networkActivity: {
                    activeConnections: 0,
                    requestsPerMinute: 0,
                    errorRate: 0
                }
            };
            res.json({
                success: true,
                data: metrics
            });
        }
        catch (error) {
            logger_1.default.error('❌ Realtime metrics error:', error);
            next(error);
        }
    }
    calculateThreatTrends(threats) {
        const now = new Date();
        const last24h = threats.filter(t => new Date(t.timestamp).getTime() > now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = threats.filter(t => new Date(t.timestamp).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
            last24Hours: last24h.length,
            last7Days: last7d.length,
            trend: last24h.length > last7d.length / 7 ? 'increasing' : 'stable',
            severityBreakdown: {
                critical: threats.filter(t => t.severity === 'critical').length,
                high: threats.filter(t => t.severity === 'high').length,
                medium: threats.filter(t => t.severity === 'medium').length,
                low: threats.filter(t => t.severity === 'low').length
            }
        };
    }
    async getSystemHealthMetrics() {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        return {
            status: 'healthy',
            uptime: uptime,
            memoryUsage: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
            },
            responseTime: 0,
            errorRate: 0
        };
    }
    formatThreatMessage(threat) {
        switch (threat.type) {
            case 'BRUTE_FORCE':
                return `Brute force attack detected from ${this.maskIP(threat.ipAddress)}`;
            case 'API_ABUSE':
                return `API abuse detected: ${threat.details.reason || 'Automated requests'}`;
            case 'SUSPICIOUS_BEHAVIOR':
                return `Suspicious user behavior: ${threat.details.pattern || 'Anomalous activity'}`;
            case 'GEOLOCATION_ANOMALY':
                return `Login from unusual location: ${threat.details.riskType || 'High-risk country'}`;
            default:
                return `Security threat detected: ${threat.type}`;
        }
    }
    maskIP(ipAddress) {
        const parts = ipAddress.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
        }
        return ipAddress.substring(0, ipAddress.length - 3) + '***';
    }
}
exports.SecurityController = SecurityController;
const securityController = new SecurityController();
exports.getSecurityDashboard = [rbac_1.requireAdmin, securityController.getSecurityDashboard.bind(securityController)];
exports.getSecurityAlerts = [rbac_1.requireAdmin, securityController.getSecurityAlerts.bind(securityController)];
exports.testSMSSecurity = [rbac_1.requireAdmin, securityController.testSMSSecurity.bind(securityController)];
exports.getSecurityConfig = [rbac_1.requireAdmin, securityController.getSecurityConfig.bind(securityController)];
exports.cleanupSecurity = [rbac_1.requireAdmin, securityController.cleanupSecurity.bind(securityController)];
exports.getRealtimeMetrics = [rbac_1.requireAdmin, securityController.getRealtimeMetrics.bind(securityController)];
exports.default = securityController;
//# sourceMappingURL=securityController.js.map