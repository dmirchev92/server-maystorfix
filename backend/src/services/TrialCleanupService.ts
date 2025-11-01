/**
 * Trial Cleanup Service
 * Runs periodically to check and disable SMS for expired FREE tier trials
 * Prevents exploitation by users staying logged in
 */

import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import logger from '../utils/logger';

export class TrialCleanupService {
  private database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Start the cleanup service (runs every hour)
   */
  start() {
    logger.info('🧹 Starting Trial Cleanup Service - checking every hour');
    
    // Run immediately on start
    this.runCleanup();
    
    // Then run every hour
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('🛑 Trial Cleanup Service stopped');
    }
  }

  /**
   * Run the cleanup process
   */
  private async runCleanup() {
    try {
      logger.info('🧹 Running trial cleanup...');

      // Find all FREE tier users with expired trials (either by cases or time)
      const expiredUsers = await this.database.query(`
        SELECT 
          u.id,
          u.email,
          u.trial_started_at,
          u.trial_cases_used,
          u.trial_expired,
          s.is_enabled as sms_enabled,
          EXTRACT(EPOCH FROM (NOW() - u.trial_started_at)) / 86400 as days_elapsed
        FROM users u
        LEFT JOIN sms_settings s ON u.id = s.user_id
        WHERE u.role = 'tradesperson'
          AND u.subscription_tier_id = 'free'
          AND u.trial_started_at IS NOT NULL
          AND (
            u.trial_cases_used >= 5 
            OR EXTRACT(EPOCH FROM (NOW() - u.trial_started_at)) / 86400 >= 14
          )
          AND (s.is_enabled = TRUE OR s.is_enabled IS NULL)
      `);

      if (expiredUsers.length === 0) {
        logger.info('✅ No expired trials with SMS enabled found');
        return;
      }

      logger.info(`📵 Found ${expiredUsers.length} expired trials with SMS enabled`);

      let disabledCount = 0;
      let markedExpiredCount = 0;

      for (const user of expiredUsers) {
        try {
          const reason = user.trial_cases_used >= 5 ? 'cases_limit' : 'time_limit';
          
          // Disable SMS
          await this.database.query(
            `UPDATE sms_settings 
             SET is_enabled = FALSE, updated_at = NOW() 
             WHERE user_id = $1`,
            [user.id]
          );

          // If no SMS settings exist, create them disabled
          await this.database.query(
            `INSERT INTO sms_settings (id, user_id, is_enabled, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, FALSE, NOW(), NOW())
             ON CONFLICT (user_id) DO UPDATE SET is_enabled = FALSE, updated_at = NOW()`,
            [user.id]
          );

          disabledCount++;

          // Mark trial as expired
          if (!user.trial_expired) {
            await this.database.query(
              `UPDATE users SET trial_expired = TRUE, updated_at = NOW() WHERE id = $1`,
              [user.id]
            );
            markedExpiredCount++;
          }

          logger.info('📵 SMS disabled for expired trial', {
            userId: user.id,
            email: user.email,
            reason,
            casesUsed: user.trial_cases_used,
            daysElapsed: Math.floor(user.days_elapsed)
          });

        } catch (userError) {
          logger.error('❌ Error processing user in cleanup', {
            userId: user.id,
            error: userError
          });
        }
      }

      logger.info('✅ Trial cleanup completed', {
        totalProcessed: expiredUsers.length,
        smsDisabled: disabledCount,
        trialsMarkedExpired: markedExpiredCount
      });

    } catch (error) {
      logger.error('❌ Error in trial cleanup service', { error });
    }
  }

  /**
   * Manual trigger for testing
   */
  async runManual() {
    logger.info('🧪 Manual trial cleanup triggered');
    await this.runCleanup();
  }
}

export default new TrialCleanupService();
