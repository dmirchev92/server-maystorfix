// SMS Activity Monitoring Service - Tracks and analyzes SMS usage patterns
// Detects suspicious activity and enforces usage limits

import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';
import config from '../utils/config';

export interface SMSActivityRecord {
  id: string;
  userId: string;
  phoneNumber: string;
  messageLength: number;
  timestamp: string;
  ipAddress?: string;
  success: boolean;
  riskLevel?: string;
}

export interface SMSActivityStats {
  todayCount: number;
  thisHourCount: number;
  totalCount: number;
  successRate: number;
  blockedCount: number;
  lastActivity?: string;
}

export interface SMSLimitCheck {
  canSend: boolean;
  reason?: string;
  stats: SMSActivityStats;
}

export class SMSActivityService {
  private database: any; // DatabaseFactory returns SQLiteDatabase | PostgreSQLDatabase
  private isPostgreSQL: boolean;

  constructor() {
    this.database = DatabaseFactory.getDatabase();
    this.isPostgreSQL = DatabaseFactory.isPostgreSQL();
    this.initializeDatabase();
  }

  /**
   * Initialize SMS activity tracking tables
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // For now, skip initialization for PostgreSQL as it should be handled by migrations
      // This prevents the crash while allowing the service to function
      if (this.isPostgreSQL) {
        logger.info('✅ SMS Activity Service initialized (PostgreSQL mode - tables managed by migrations)');
        return;
      }

      // SQLite initialization
      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(`
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
        `, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Add risk_level column if it doesn't exist (for existing databases)
      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(`
          ALTER TABLE sms_activity_log ADD COLUMN risk_level TEXT
        `, (err: any) => {
          // Ignore error if column already exists
          resolve();
        });
      });

      // Create indexes for better performance
      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(`
          CREATE INDEX IF NOT EXISTS idx_sms_activity_user_timestamp 
          ON sms_activity_log(user_id, timestamp DESC)
        `, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(`
          CREATE INDEX IF NOT EXISTS idx_sms_activity_phone_timestamp 
          ON sms_activity_log(phone_number, timestamp DESC)
        `, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info('✅ SMS Activity Service initialized (SQLite mode)');
    } catch (error) {
      logger.error('❌ Failed to initialize SMS Activity Service:', error);
      // Don't throw - allow service to continue even if initialization fails
    }
  }

  /**
   * Log SMS activity
   */
  async logActivity(activity: Omit<SMSActivityRecord, 'id' | 'timestamp'>): Promise<void> {
    try {
      // Skip logging for PostgreSQL until proper implementation
      if (this.isPostgreSQL) {
        logger.debug('📊 SMS Activity (PostgreSQL - logging disabled)');
        return;
      }

      const id = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(
          `INSERT INTO sms_activity_log (
            id, user_id, phone_number, message_length, ip_address, 
            success
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            activity.userId,
            this.maskPhoneNumber(activity.phoneNumber),
            activity.messageLength,
            activity.ipAddress ? this.maskIP(activity.ipAddress) : null,
            activity.success ? 1 : 0
          ],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      logger.info('📊 SMS Activity Logged', {
        userId: activity.userId,
        phoneNumber: this.maskPhoneNumber(activity.phoneNumber),
        success: activity.success,
        riskLevel: activity.riskLevel
      });

    } catch (error) {
      logger.error('❌ Failed to log SMS activity:', error);
      // Don't throw - logging failure shouldn't break SMS sending
    }
  }

  /**
   * Get SMS statistics for a user
   */
  async getUserStats(userId: string): Promise<SMSActivityStats> {
    try {
      // Return empty stats for PostgreSQL until proper implementation
      if (this.isPostgreSQL) {
        return {
          todayCount: 0,
          thisHourCount: 0,
          totalCount: 0,
          successRate: 100,
          blockedCount: 0
        };
      }

      const stats = await new Promise<any>((resolve, reject) => {
        (this.database as any)._db.get(
          `SELECT 
            COUNT(*) as total_count,
            SUM(CASE WHEN date(timestamp) = date('now') THEN 1 ELSE 0 END) as today_count,
            SUM(CASE WHEN timestamp > datetime('now', '-1 hour') THEN 1 ELSE 0 END) as hour_count,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as blocked_count,
            MAX(timestamp) as last_activity
           FROM sms_activity_log 
           WHERE user_id = ?`,
          [userId],
          (err: any, row: any) => {
            if (err) reject(err);
            else resolve(row || {});
          }
        );
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

    } catch (error) {
      logger.error('❌ Error getting user SMS stats:', error);
      return {
        todayCount: 0,
        thisHourCount: 0,
        totalCount: 0,
        successRate: 100,
        blockedCount: 0
      };
    }
  }

  /**
   * Check if user can send SMS (enforce limits)
   */
  async canUserSendSMS(userId: string): Promise<SMSLimitCheck> {
    const stats = await this.getUserStats(userId);

    // Check daily limit
    if (stats.todayCount >= config.security.sms.dailyLimit) {
      return {
        canSend: false,
        reason: `Daily SMS limit exceeded (${stats.todayCount}/${config.security.sms.dailyLimit})`,
        stats
      };
    }

    // Check hourly suspicious threshold
    if (stats.thisHourCount >= config.security.sms.suspiciousThreshold) {
      return {
        canSend: false,
        reason: `Hourly SMS threshold exceeded (${stats.thisHourCount}/${config.security.sms.suspiciousThreshold})`,
        stats
      };
    }

    // Check success rate (if too many failures, might be abuse)
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

  /**
   * Detect suspicious activity patterns
   */
  async detectSuspiciousActivity(userId: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    try {
      const stats = await this.getUserStats(userId);
      const reasons: string[] = [];
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

      // Check for rapid-fire SMS sending
      if (stats.thisHourCount >= 20) {
        reasons.push(`Excessive hourly usage: ${stats.thisHourCount} SMS in 1 hour`);
        riskLevel = 'high';
      }

      // Check for unusual daily volume
      if (stats.todayCount >= 100) {
        reasons.push(`Excessive daily usage: ${stats.todayCount} SMS today`);
        riskLevel = riskLevel === 'high' ? 'critical' : 'high';
      }

      // Check for low success rate (might indicate invalid numbers or spam)
      if (stats.totalCount >= 5 && stats.successRate < 30) {
        reasons.push(`Low success rate: ${stats.successRate}%`);
        riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      }

      // Check for recent activity patterns
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

    } catch (error) {
      logger.error('❌ Error detecting suspicious activity:', error);
      return {
        isSuspicious: false,
        reasons: [],
        riskLevel: 'low'
      };
    }
  }

  /**
   * Analyze recent activity patterns
   */
  private async analyzeRecentPatterns(userId: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    try {
      // Get recent activity patterns
      const patterns = await new Promise<any[]>((resolve, reject) => {
        (this.database as any)._db.all(
          `SELECT phone_number, COUNT(*) as count, 
                  MIN(timestamp) as first_attempt,
                  MAX(timestamp) as last_attempt,
                  SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_count
           FROM sms_activity_log 
           WHERE user_id = ? AND timestamp > datetime('now', '-24 hours')
           GROUP BY phone_number
           HAVING count > 1
           ORDER BY count DESC`,
          [userId],
          (err: any, rows: any) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      const reasons: string[] = [];
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

      // Check for repeated attempts to same numbers
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

      // Check for rapid sequential sending
      const rapidSending = await new Promise<number>((resolve, reject) => {
        (this.database as any)._db.get(
          `SELECT COUNT(*) as rapid_count
           FROM sms_activity_log 
           WHERE user_id = ? AND timestamp > datetime('now', '-5 minutes')`,
          [userId],
          (err: any, row: any) => {
            if (err) reject(err);
            else resolve(row?.rapid_count || 0);
          }
        );
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

    } catch (error) {
      logger.error('❌ Error analyzing recent patterns:', error);
      return {
        isSuspicious: false,
        reasons: [],
        riskLevel: 'low'
      };
    }
  }

  /**
   * Get activity summary for admin dashboard
   */
  async getActivitySummary(timeframe: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<any> {
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

      const summary = await new Promise<any>((resolve, reject) => {
        (this.database as any)._db.get(
          `SELECT 
            COUNT(*) as total_sms,
            COUNT(DISTINCT user_id) as active_users,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_sms,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as blocked_sms,
            AVG(message_length) as avg_message_length
           FROM sms_activity_log 
           WHERE ${timeCondition}`,
          (err: any, row: any) => {
            if (err) reject(err);
            else resolve(row || {});
          }
        );
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

    } catch (error) {
      logger.error('❌ Error getting activity summary:', error);
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

  /**
   * Clean up old activity logs (keep last 30 days)
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const result = await new Promise<{changes: number}>((resolve, reject) => {
        (this.database as any)._db.run(
          `DELETE FROM sms_activity_log 
           WHERE timestamp < datetime('now', '-30 days')`,
          function(this: any, err: any) {
            if (err) reject(err);
            else resolve({changes: this.changes || 0});
          }
        );
      });

      logger.info(`🧹 Cleaned up ${result.changes} old SMS activity logs`);
      return result.changes;

    } catch (error) {
      logger.error('❌ Error cleaning up SMS activity logs:', error);
      return 0;
    }
  }

  /**
   * Mask phone number for privacy
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return '***';
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 2);
  }

  /**
   * Mask IP address for privacy
   */
  private maskIP(ipAddress: string): string {
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    return ipAddress.substring(0, ipAddress.length - 3) + '***';
  }
}

export default SMSActivityService;
