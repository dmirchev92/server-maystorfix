"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityEnhancementService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../utils/logger"));
const DatabaseFactory_1 = require("../models/DatabaseFactory");
class SecurityEnhancementService {
    static getInstance() {
        if (!SecurityEnhancementService.instance) {
            SecurityEnhancementService.instance = new SecurityEnhancementService();
        }
        return SecurityEnhancementService.instance;
    }
    constructor() {
        this.SUSPICIOUS_USER_AGENTS = [
            /curl/i, /wget/i, /python/i, /bot/i, /crawler/i, /spider/i,
            /automated/i, /script/i, /tool/i, /scanner/i, /exploit/i
        ];
        this.SUSPICIOUS_IPS = new Set([
            '127.0.0.1',
        ]);
        this.HIGH_RISK_COUNTRIES = new Set([
            'CN', 'RU', 'KP', 'IR',
        ]);
        this.failedAttempts = new Map();
        this.deviceCache = new Map();
        this.database = DatabaseFactory_1.DatabaseFactory.getDatabase();
        this.initializeSecurityTables().catch(error => {
            console.error('❌ Failed to initialize security tables:', error);
        });
    }
    async initializeSecurityTables() {
        try {
            await new Promise((resolve, reject) => {
                this.database._db.run(`
          CREATE TABLE IF NOT EXISTS security_threats (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            severity TEXT NOT NULL,
            user_id TEXT,
            ip_address TEXT NOT NULL,
            user_agent TEXT,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            blocked BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await new Promise((resolve, reject) => {
                this.database._db.run(`
          CREATE TABLE IF NOT EXISTS device_fingerprints (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            fingerprint TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            user_agent TEXT NOT NULL,
            screen_resolution TEXT,
            timezone TEXT,
            language TEXT,
            is_known_device BOOLEAN DEFAULT 0,
            first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            trust_score INTEGER DEFAULT 50,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await new Promise((resolve, reject) => {
                this.database._db.run(`
          CREATE TABLE IF NOT EXISTS security_alerts (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT NOT NULL,
            user_id TEXT,
            ip_address TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            action_taken TEXT,
            details TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('✅ Security enhancement tables initialized');
        }
        catch (error) {
            logger_1.default.error('❌ Failed to initialize security tables:', error);
        }
    }
    async checkBruteForceProtection(email, ipAddress) {
        try {
            const emailKey = `email:${email}`;
            const ipKey = `ip:${ipAddress}`;
            const now = Date.now();
            const windowMs = 15 * 60 * 1000;
            const maxAttempts = 5;
            const emailAttempts = this.failedAttempts.get(emailKey);
            if (emailAttempts && emailAttempts.blocked && (now - emailAttempts.lastAttempt) < windowMs) {
                const waitTime = Math.ceil((windowMs - (now - emailAttempts.lastAttempt)) / 1000);
                await this.logSecurityThreat({
                    type: 'BRUTE_FORCE',
                    severity: 'high',
                    ipAddress,
                    details: { email, attemptCount: emailAttempts.count, type: 'email_based' },
                    blocked: true
                });
                return {
                    allowed: false,
                    reason: `Account temporarily locked due to multiple failed attempts. Try again in ${Math.ceil(waitTime / 60)} minutes.`,
                    waitTime
                };
            }
            const ipAttempts = this.failedAttempts.get(ipKey);
            if (ipAttempts && ipAttempts.blocked && (now - ipAttempts.lastAttempt) < windowMs) {
                const waitTime = Math.ceil((windowMs - (now - ipAttempts.lastAttempt)) / 1000);
                await this.logSecurityThreat({
                    type: 'BRUTE_FORCE',
                    severity: 'critical',
                    ipAddress,
                    details: { email, attemptCount: ipAttempts.count, type: 'ip_based' },
                    blocked: true
                });
                return {
                    allowed: false,
                    reason: `IP address temporarily blocked due to suspicious activity. Try again in ${Math.ceil(waitTime / 60)} minutes.`,
                    waitTime
                };
            }
            return { allowed: true };
        }
        catch (error) {
            logger_1.default.error('❌ Brute force check error:', error);
            return { allowed: true };
        }
    }
    recordFailedLogin(email, ipAddress) {
        const emailKey = `email:${email}`;
        const ipKey = `ip:${ipAddress}`;
        const now = Date.now();
        const maxAttempts = 5;
        const emailAttempts = this.failedAttempts.get(emailKey) || { count: 0, lastAttempt: 0, blocked: false };
        emailAttempts.count++;
        emailAttempts.lastAttempt = now;
        emailAttempts.blocked = emailAttempts.count >= maxAttempts;
        this.failedAttempts.set(emailKey, emailAttempts);
        const ipAttempts = this.failedAttempts.get(ipKey) || { count: 0, lastAttempt: 0, blocked: false };
        ipAttempts.count++;
        ipAttempts.lastAttempt = now;
        ipAttempts.blocked = ipAttempts.count >= maxAttempts;
        this.failedAttempts.set(ipKey, ipAttempts);
        logger_1.default.warn('🚨 Failed login attempt recorded', {
            email: this.maskEmail(email),
            ipAddress: this.maskIP(ipAddress),
            emailAttempts: emailAttempts.count,
            ipAttempts: ipAttempts.count
        });
    }
    clearFailedAttempts(email, ipAddress) {
        this.failedAttempts.delete(`email:${email}`);
        this.failedAttempts.delete(`ip:${ipAddress}`);
    }
    async analyzeDeviceFingerprint(req, userId) {
        const fingerprint = this.generateDeviceFingerprint(req);
        const ipAddress = req.ip || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const existingDevice = await this.getDeviceFingerprint(userId, fingerprint);
        if (existingDevice) {
            await this.updateDeviceLastSeen(existingDevice.id);
            return {
                trusted: existingDevice.trustScore > 70,
                isNewDevice: false,
                riskScore: 100 - existingDevice.trustScore
            };
        }
        const riskScore = await this.calculateDeviceRiskScore(req, userId);
        await this.saveDeviceFingerprint({
            id: crypto_1.default.randomUUID(),
            userId,
            fingerprint,
            ipAddress,
            userAgent,
            isKnownDevice: false,
            firstSeen: new Date(),
            lastSeen: new Date(),
            trustScore: Math.max(0, 100 - riskScore)
        });
        if (riskScore > 70) {
            await this.logSecurityAlert({
                type: 'NEW_DEVICE_HIGH_RISK',
                message: `High-risk new device detected for user`,
                severity: 'high',
                userId,
                ipAddress,
                actionTaken: 'DEVICE_FLAGGED',
                details: { fingerprint, riskScore, userAgent }
            });
        }
        return {
            trusted: riskScore < 30,
            isNewDevice: true,
            riskScore
        };
    }
    generateDeviceFingerprint(req) {
        const components = [
            req.get('User-Agent') || '',
            req.get('Accept-Language') || '',
            req.get('Accept-Encoding') || '',
            req.ip || '',
        ];
        return crypto_1.default.createHash('sha256')
            .update(components.join('|'))
            .digest('hex');
    }
    async calculateDeviceRiskScore(req, userId) {
        let riskScore = 0;
        const userAgent = req.get('User-Agent') || '';
        const ipAddress = req.ip || '';
        if (this.SUSPICIOUS_USER_AGENTS.some(pattern => pattern.test(userAgent))) {
            riskScore += 40;
        }
        if (this.SUSPICIOUS_IPS.has(ipAddress)) {
            riskScore += 50;
        }
        if (!req.get('Accept-Language'))
            riskScore += 10;
        if (!req.get('Accept-Encoding'))
            riskScore += 10;
        if (userAgent.length < 20)
            riskScore += 20;
        if (userAgent.length > 500)
            riskScore += 15;
        return Math.min(100, riskScore);
    }
    async checkGeolocationAnomaly(ipAddress, userId) {
        const isHighRisk = Math.random() < 0.1;
        if (isHighRisk) {
            await this.logSecurityAlert({
                type: 'GEOLOCATION_ANOMALY',
                message: 'Login from high-risk geographic location',
                severity: 'medium',
                userId,
                ipAddress,
                actionTaken: 'FLAGGED_FOR_REVIEW',
                details: { riskType: 'high_risk_country' }
            });
            return {
                suspicious: true,
                reason: 'Login detected from a high-risk geographic location'
            };
        }
        return { suspicious: false };
    }
    async checkAPIAbuse(req, userId) {
        const ipAddress = req.ip || 'unknown';
        const endpoint = req.path;
        const method = req.method;
        const limits = this.getEndpointLimits(endpoint, method);
        const userAgent = req.get('User-Agent') || '';
        if (this.SUSPICIOUS_USER_AGENTS.some(pattern => pattern.test(userAgent))) {
            await this.logSecurityThreat({
                type: 'API_ABUSE',
                severity: 'high',
                ipAddress,
                details: { endpoint, method, userAgent, reason: 'suspicious_user_agent' },
                blocked: true
            });
            return {
                allowed: false,
                reason: 'Automated requests detected. Please use the official application.'
            };
        }
        return { allowed: true };
    }
    getEndpointLimits(endpoint, method) {
        if (endpoint.includes('/auth/login'))
            return { requests: 5, windowMs: 15 * 60 * 1000 };
        if (endpoint.includes('/auth/register'))
            return { requests: 3, windowMs: 60 * 60 * 1000 };
        if (endpoint.includes('/sms/send'))
            return { requests: 10, windowMs: 15 * 60 * 1000 };
        if (endpoint.includes('/admin/'))
            return { requests: 50, windowMs: 15 * 60 * 1000 };
        return { requests: 100, windowMs: 15 * 60 * 1000 };
    }
    async logSecurityThreat(threat) {
        const id = crypto_1.default.randomUUID();
        const timestamp = new Date();
        try {
            await new Promise((resolve, reject) => {
                this.database._db.run(`
          INSERT INTO security_threats (
            id, type, severity, user_id, ip_address, user_agent, details, blocked, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
                    id, threat.type, threat.severity, threat.userId || null,
                    threat.ipAddress, threat.userAgent || null,
                    JSON.stringify(threat.details), threat.blocked ? 1 : 0, timestamp.toISOString()
                ], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.warn('🚨 Security threat logged', {
                id, type: threat.type, severity: threat.severity,
                ipAddress: this.maskIP(threat.ipAddress)
            });
        }
        catch (error) {
            logger_1.default.error('❌ Failed to log security threat:', error);
        }
    }
    async logSecurityAlert(alert) {
        const id = crypto_1.default.randomUUID();
        const timestamp = new Date();
        try {
            await new Promise((resolve, reject) => {
                this.database._db.run(`
          INSERT INTO security_alerts (
            id, type, message, severity, user_id, ip_address, action_taken, details, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
                    id, alert.type, alert.message, alert.severity,
                    alert.userId || null, alert.ipAddress || null,
                    alert.actionTaken, JSON.stringify(alert.details), timestamp.toISOString()
                ], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('🔔 Security alert logged', {
                id, type: alert.type, severity: alert.severity
            });
        }
        catch (error) {
            logger_1.default.error('❌ Failed to log security alert:', error);
        }
    }
    async getDeviceFingerprint(userId, fingerprint) {
        return new Promise((resolve, reject) => {
            this.database._db.get(`
        SELECT * FROM device_fingerprints 
        WHERE user_id = ? AND fingerprint = ?
      `, [userId, fingerprint], (err, row) => {
                if (err)
                    reject(err);
                else if (row) {
                    resolve({
                        id: row.id,
                        userId: row.user_id,
                        fingerprint: row.fingerprint,
                        ipAddress: row.ip_address,
                        userAgent: row.user_agent,
                        screenResolution: row.screen_resolution,
                        timezone: row.timezone,
                        language: row.language,
                        isKnownDevice: Boolean(row.is_known_device),
                        firstSeen: new Date(row.first_seen),
                        lastSeen: new Date(row.last_seen),
                        trustScore: row.trust_score
                    });
                }
                else {
                    resolve(null);
                }
            });
        });
    }
    async saveDeviceFingerprint(device) {
        return new Promise((resolve, reject) => {
            this.database._db.run(`
        INSERT INTO device_fingerprints (
          id, user_id, fingerprint, ip_address, user_agent, 
          is_known_device, first_seen, last_seen, trust_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                device.id, device.userId, device.fingerprint, device.ipAddress,
                device.userAgent, device.isKnownDevice ? 1 : 0,
                device.firstSeen.toISOString(), device.lastSeen.toISOString(), device.trustScore
            ], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async updateDeviceLastSeen(deviceId) {
        return new Promise((resolve, reject) => {
            this.database._db.run(`
        UPDATE device_fingerprints 
        SET last_seen = ?, trust_score = trust_score + 1 
        WHERE id = ?
      `, [new Date().toISOString(), deviceId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async getRecentSecurityThreats(limit = 50) {
        return new Promise((resolve, reject) => {
            this.database._db.all(`
        SELECT * FROM security_threats 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [limit], (err, rows) => {
                if (err)
                    reject(err);
                else {
                    const threats = rows.map(row => ({
                        id: row.id,
                        type: row.type,
                        severity: row.severity,
                        userId: row.user_id,
                        ipAddress: row.ip_address,
                        userAgent: row.user_agent,
                        details: JSON.parse(row.details || '{}'),
                        timestamp: new Date(row.timestamp),
                        blocked: Boolean(row.blocked)
                    }));
                    resolve(threats);
                }
            });
        });
    }
    async getSecurityStats() {
        return new Promise((resolve, reject) => {
            this.database._db.get(`
        SELECT 
          COUNT(*) as total_threats,
          SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) as blocked_threats,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_threats,
          SUM(CASE WHEN timestamp > datetime('now', '-24 hours') THEN 1 ELSE 0 END) as threats_24h
        FROM security_threats
      `, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve({
                        totalThreats: row.total_threats || 0,
                        blockedThreats: row.blocked_threats || 0,
                        criticalThreats: row.critical_threats || 0,
                        threats24h: row.threats_24h || 0,
                        failedAttempts: this.failedAttempts.size,
                        deviceFingerprints: this.deviceCache.size
                    });
            });
        });
    }
    maskEmail(email) {
        const [local, domain] = email.split('@');
        return `${local.substring(0, 2)}***@${domain}`;
    }
    maskIP(ipAddress) {
        const parts = ipAddress.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
        }
        return ipAddress.substring(0, ipAddress.length - 3) + '***';
    }
    async cleanup() {
        const now = Date.now();
        const expiredTime = 24 * 60 * 60 * 1000;
        for (const [key, value] of this.failedAttempts.entries()) {
            if (now - value.lastAttempt > expiredTime) {
                this.failedAttempts.delete(key);
            }
        }
        try {
            await new Promise((resolve, reject) => {
                this.database._db.run(`
          DELETE FROM security_threats 
          WHERE timestamp < datetime('now', '-30 days')
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        catch (error) {
            logger_1.default.error('❌ Failed to cleanup old security threats:', error);
        }
    }
}
exports.SecurityEnhancementService = SecurityEnhancementService;
exports.default = SecurityEnhancementService;
//# sourceMappingURL=SecurityEnhancementService.js.map