/**
 * One-time script to send trial expiration notifications to users who expired before the notification system was implemented
 */

import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import NotificationService from '../services/NotificationService';
import logger from '../utils/logger';

async function notifyExpiredTrials() {
  const database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;
  const notificationService = new NotificationService();

  try {
    logger.info('🔍 Finding users with expired trials...');

    // Get all users with expired trials
    const query = `
      SELECT 
        id,
        email,
        first_name,
        last_name,
        subscription_tier_id,
        trial_started_at,
        trial_cases_used,
        trial_expired,
        created_at
      FROM users 
      WHERE trial_expired = TRUE 
        AND subscription_tier_id = 'free'
      ORDER BY email
    `;

    const expiredUsers = await database.query(query);

    if (expiredUsers.length === 0) {
      logger.info('✅ No expired trial users found');
      return;
    }

    logger.info(`📧 Found ${expiredUsers.length} expired trial users. Sending notifications...`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of expiredUsers) {
      try {
        // Determine expiration reason
        let reason: 'cases_limit' | 'time_limit' = 'cases_limit';
        
        if (user.trial_cases_used >= 5) {
          reason = 'cases_limit';
        } else if (user.trial_started_at) {
          const trialStarted = new Date(user.trial_started_at);
          const now = new Date();
          const daysElapsed = Math.floor((now.getTime() - trialStarted.getTime()) / (1000 * 60 * 60 * 24));
          if (daysElapsed >= 14) {
            reason = 'time_limit';
          }
        }

        // Send notification
        await notificationService.notifyTrialExpired(user.id, reason);
        
        logger.info(`✅ Notification sent to ${user.email} (${user.first_name} ${user.last_name}) - Reason: ${reason}`);
        successCount++;

      } catch (error) {
        logger.error(`❌ Failed to send notification to ${user.email}:`, error);
        errorCount++;
      }
    }

    logger.info(`\n📊 Summary:`);
    logger.info(`   ✅ Success: ${successCount}`);
    logger.info(`   ❌ Failed: ${errorCount}`);
    logger.info(`   📧 Total: ${expiredUsers.length}`);

    process.exit(0);

  } catch (error) {
    logger.error('❌ Error in notifyExpiredTrials script:', error);
    process.exit(1);
  }
}

// Run the script
notifyExpiredTrials();
