"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSActivityService = void 0;
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const logger_1 = __importDefault(require("../utils/logger"));
const config_1 = __importDefault(require("../utils/config"));
class SMSActivityService {
    constructor() {
        this.database = DatabaseFactory_1.DatabaseFactory.getDatabase();
        this.isPostgreSQL = DatabaseFactory_1.DatabaseFactory.isPostgreSQL();
        this.initializeDatabase();
    }
    async initializeDatabase() {
        try {
            if (this.isPostgreSQL) {
                logger_1.default.info('✅ SMS Activity Service initialized (PostgreSQL mode - tables managed by migrations)');
                return;
            }
            await new Promise((resolve, reject) => {
                this.database._db.run(`
          CREATE TABLE IF NOT EXISTS sms_activity_log (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            message_length INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            success INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
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
          ALTER TABLE sms_activity_log ADD COLUMN risk_level TEXT
        `, (err) => {
                    resolve();
                });
            });
            await new Promise((resolve, reject) => {
                this.database._db.run(`
          CREATE INDEX IF NOT EXISTS idx_sms_activity_user_timestamp 
          ON sms_activity_log(user_id, timestamp DESC)
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await new Promise((resolve, reject) => {
                this.database._db.run(`
          CREATE INDEX IF NOT EXISTS idx_sms_activity_phone_timestamp 
          ON sms_activity_log(phone_number, timestamp DESC)
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('✅ SMS Activity Service initialized (SQLite mode)');
        }
        catch (error) {
            logger_1.default.error('❌ Failed to initialize SMS Activity Service:', error);
        }
    }
    async logActivity(activity) {
        try {
            if (this.isPostgreSQL) {
                logger_1.default.debug('📊 SMS Activity (PostgreSQL - logging disabled)');
                return;
            }
            const id = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await new Promise((resolve, reject) => {
                this.database._db.run(`INSERT INTO sms_activity_log (
            id, user_id, phone_number, message_length, ip_address, 
            success
          ) VALUES (?, ?, ?, ?, ?, ?)`, [
                    id,
                    activity.userId,
                    this.maskPhoneNumber(activity.phoneNumber),
                    activity.messageLength,
                    activity.ipAddress ? this.maskIP(activity.ipAddress) : null,
                    activity.success ? 1 : 0
                ], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('📊 SMS Activity Logged', {
                userId: activity.userId,
                phoneNumber: this.maskPhoneNumber(activity.phoneNumber),
                success: activity.success,
                riskLevel: activity.riskLevel
            });
        }
        catch (error) {
            logger_1.default.error('❌ Failed to log SMS activity:', error);
        }
    }
    async getUserStats(userId) {
        try {
            if (this.isPostgreSQL) {
                return {
                    todayCount: 0,
                    thisHourCount: 0,
                    totalCount: 0,
                    successRate: 100,
                    blockedCount: 0
                };
            }
            const stats = await new Promise((resolve, reject) => {
                this.database._db.get(`SELECT 
            COUNT(*) as total_count,
            SUM(CASE WHEN date(timestamp) = date('now') THEN 1 ELSE 0 END) as today_count,
            SUM(CASE WHEN timestamp > datetime('now', '-1 hour') THEN 1 ELSE 0 END) as hour_count,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as blocked_count,
            MAX(timestamp) as last_activity
           FROM sms_activity_log 
           WHERE user_id = ?`, [userId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row || {});
                });
            });
            const totalCount = stats.total_count || 0;
            const successCount = stats.success_count || 0;
            const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;
            return {
                todayCount: stats.today_count || 0,
                thisHourCount: stats.hour_count || 0,
                totalCount: totalCount,
                successRate: Math.round(successRate * 100) / 100,
                blockedCount: stats.blocked_count || 0,
                lastActivity: stats.last_activity
            };
        }
        catch (error) {
            logger_1.default.error('❌ Error getting user SMS stats:', error);
            return {
                todayCount: 0,
                thisHourCount: 0,
                totalCount: 0,
                successRate: 100,
                blockedCount: 0
            };
        }
    }
    async canUserSendSMS(userId) {
        const stats = await this.getUserStats(userId);
        if (stats.todayCount >= config_1.default.security.sms.dailyLimit) {
            return {
                canSend: false,
                reason: `Daily SMS limit exceeded (${stats.todayCount}/${config_1.default.security.sms.dailyLimit})`,
                stats
            };
        }
        if (stats.thisHourCount >= config_1.default.security.sms.suspiciousThreshold) {
            return {
                canSend: false,
                reason: `Hourly SMS threshold exceeded (${stats.thisHourCount}/${config_1.default.security.sms.suspiciousThreshold})`,
                stats
            };
        }
        if (stats.totalCount >= 10 && stats.successRate < 50) {
            return {
                canSend: false,
                reason: `Low success rate detected (${stats.successRate}%) - possible abuse`,
                stats
            };
        }
        return {
            canSend: true,
            stats
        };
    }
    async detectSuspiciousActivity(userId) {
        try {
            const stats = await this.getUserStats(userId);
            const reasons = [];
            let riskLevel = 'low';
            if (stats.thisHourCount >= 20) {
                reasons.push(`Excessive hourly usage: ${stats.thisHourCount} SMS in 1 hour`);
                riskLevel = 'high';
            }
            if (stats.todayCount >= 100) {
                reasons.push(`Excessive daily usage: ${stats.todayCount} SMS today`);
                riskLevel = riskLevel === 'high' ? 'critical' : 'high';
            }
            if (stats.totalCount >= 5 && stats.successRate < 30) {
                reasons.push(`Low success rate: ${stats.successRate}%`);
                riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
            }
            const recentPatterns = await this.analyzeRecentPatterns(userId);
            if (recentPatterns.isSuspicious) {
                reasons.push(...recentPatterns.reasons);
                riskLevel = recentPatterns.riskLevel;
            }
            return {
                isSuspicious: reasons.length > 0,
                reasons,
                riskLevel
            };
        }
        catch (error) {
            logger_1.default.error('❌ Error detecting suspicious activity:', error);
            return {
                isSuspicious: false,
                reasons: [],
                riskLevel: 'low'
            };
        }
    }
    async analyzeRecentPatterns(userId) {
        try {
            const patterns = await new Promise((resolve, reject) => {
                this.database._db.all(`SELECT phone_number, COUNT(*) as count, 
                  MIN(timestamp) as first_attempt,
                  MAX(timestamp) as last_attempt,
                  SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_count
           FROM sms_activity_log 
           WHERE user_id = ? AND timestamp > datetime('now', '-24 hours')
           GROUP BY phone_number
           HAVING count > 1
           ORDER BY count DESC`, [userId], (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            });
            const reasons = [];
            let riskLevel = 'low';
            for (const pattern of patterns) {
                if (pattern.count >= 5) {
                    reasons.push(`Repeated SMS to same number: ${pattern.count} attempts`);
                    riskLevel = 'medium';
                }
                if (pattern.failed_count >= 3) {
                    reasons.push(`Multiple failures to same number: ${pattern.failed_count} failures`);
                    riskLevel = riskLevel === 'low' ? 'medium' : 'high';
                }
            }
            const rapidSending = await new Promise((resolve, reject) => {
                this.database._db.get(`SELECT COUNT(*) as rapid_count
           FROM sms_activity_log 
           WHERE user_id = ? AND timestamp > datetime('now', '-5 minutes')`, [userId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.rapid_count || 0);
                });
            });
            if (rapidSending >= 10) {
                reasons.push(`Rapid sending detected: ${rapidSending} SMS in 5 minutes`);
                riskLevel = 'critical';
            }
            return {
                isSuspicious: reasons.length > 0,
                reasons,
                riskLevel
            };
        }
        catch (error) {
            logger_1.default.error('❌ Error analyzing recent patterns:', error);
            return {
                isSuspicious: false,
                reasons: [],
                riskLevel: 'low'
            };
        }
    }
    async getActivitySummary(timeframe = '24h') {
        try {
            let timeCondition = '';
            switch (timeframe) {
                case '1h':
                    timeCondition = "timestamp > datetime('now', '-1 hour')";
                    break;
                case '24h':
                    timeCondition = "timestamp > datetime('now', '-1 day')";
                    break;
                case '7d':
                    timeCondition = "timestamp > datetime('now', '-7 days')";
                    break;
                case '30d':
                    timeCondition = "timestamp > datetime('now', '-30 days')";
                    break;
            }
            const summary = await new Promise((resolve, reject) => {
                this.database._db.get(`SELECT 
            COUNT(*) as total_sms,
            COUNT(DISTINCT user_id) as active_users,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_sms,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as blocked_sms,
            AVG(message_length) as avg_message_length
           FROM sms_activity_log 
           WHERE ${timeCondition}`, (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row || {});
                });
            });
            return {
                timeframe,
                totalSMS: summary.total_sms || 0,
                activeUsers: summary.active_users || 0,
                successfulSMS: summary.successful_sms || 0,
                blockedSMS: summary.blocked_sms || 0,
                successRate: summary.total_sms > 0 ?
                    Math.round((summary.successful_sms / summary.total_sms) * 100) : 100,
                avgMessageLength: Math.round(summary.avg_message_length || 0)
            };
        }
        catch (error) {
            logger_1.default.error('❌ Error getting activity summary:', error);
            return {
                timeframe,
                totalSMS: 0,
                activeUsers: 0,
                successfulSMS: 0,
                blockedSMS: 0,
                successRate: 100,
                avgMessageLength: 0
            };
        }
    }
    async cleanupOldLogs() {
        try {
            const result = await new Promise((resolve, reject) => {
                this.database._db.run(`DELETE FROM sms_activity_log 
           WHERE timestamp < datetime('now', '-30 days')`, function (err) {
                    if (err)
                        reject(err);
                    else
                        resolve({ changes: this.changes || 0 });
                });
            });
            logger_1.default.info(`🧹 Cleaned up ${result.changes} old SMS activity logs`);
            return result.changes;
        }
        catch (error) {
            logger_1.default.error('❌ Error cleaning up SMS activity logs:', error);
            return 0;
        }
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
}
exports.SMSActivityService = SMSActivityService;
exports.default = SMSActivityService;
//# sourceMappingURL=SMSActivityService.js.map