// Subscription Reminder Service
// Sends reminder emails before subscription expiry

import cron from 'node-cron';
import { DatabaseFactory } from '../models/DatabaseFactory';
import EmailService from './EmailService';
import config from '../utils/config';
import logger from '../utils/logger';

interface SubscriptionExpiryUser {
  id: string;
  email: string;
  first_name: string;
  subscription_tier_id: string;
  subscription_expires_at: Date;
  days_until_expiry: number;
}

class SubscriptionReminderService {
  private static instance: SubscriptionReminderService;
  private database: any;
  private isRunning: boolean = false;

  private constructor() {
    this.database = DatabaseFactory.getDatabase();
  }

  public static getInstance(): SubscriptionReminderService {
    if (!SubscriptionReminderService.instance) {
      SubscriptionReminderService.instance = new SubscriptionReminderService();
    }
    return SubscriptionReminderService.instance;
  }

  /**
   * Start the cron job for subscription reminders
   * Runs daily at 9:00 AM Sofia time
   */
  public startCronJob(): void {
    // Run daily at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
      await this.processSubscriptionReminders();
    }, {
      timezone: 'Europe/Sofia'
    });

    logger.info('📅 Subscription reminder cron job started (daily at 9:00 AM Sofia time)');
  }

  /**
   * Process subscription reminders
   */
  public async processSubscriptionReminders(): Promise<void> {
    if (this.isRunning) {
      logger.warn('⚠️ Subscription reminder job already running, skipping...');
      return;
    }

    this.isRunning = true;
    logger.info('📧 Starting subscription reminder job...');

    try {
      const reminderDays = config.communication.email.subscriptionReminder.daysBeforeExpiry;
      
      for (const days of reminderDays) {
        await this.sendRemindersForDays(days);
      }

      // Also check for expired subscriptions
      await this.processExpiredSubscriptions();

      logger.info('✅ Subscription reminder job completed');
    } catch (error) {
      logger.error('❌ Subscription reminder job failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Send reminders for users expiring in X days
   */
  private async sendRemindersForDays(days: number): Promise<void> {
    try {
      // Find users with subscriptions expiring in X days
      const users = await this.database.query(`
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.subscription_tier_id,
          u.subscription_expires_at,
          EXTRACT(DAY FROM (u.subscription_expires_at - NOW())) as days_until_expiry
        FROM users u
        WHERE u.role = 'tradesperson'
          AND u.subscription_tier_id IN ('normal', 'pro')
          AND u.subscription_status = 'active'
          AND u.subscription_expires_at IS NOT NULL
          AND DATE(u.subscription_expires_at) = DATE(NOW() + INTERVAL '${days} days')
          AND u.email IS NOT NULL
          AND u.email != ''
      `);

      if (!users || users.length === 0) {
        logger.info(`📧 No users with subscriptions expiring in ${days} days`);
        return;
      }

      logger.info(`📧 Found ${users.length} users with subscriptions expiring in ${days} days`);

      for (const user of users) {
        try {
          // Check if we already sent a reminder for this period
          const existingReminder = await this.database.query(`
            SELECT id FROM email_logs 
            WHERE user_id = $1 
              AND email_type = 'subscription_expiry_reminder'
              AND created_at > NOW() - INTERVAL '24 hours'
          `, [user.id]);

          if (existingReminder && existingReminder.length > 0) {
            logger.info(`📧 Reminder already sent to ${user.email} today, skipping`);
            continue;
          }

          await EmailService.sendSubscriptionExpiryReminder(
            user.email,
            user.first_name || 'Потребител',
            days,
            user.subscription_tier_id,
            new Date(user.subscription_expires_at),
            user.id
          );

          logger.info(`📧 Sent ${days}-day expiry reminder to ${user.email}`);
        } catch (error) {
          logger.error(`❌ Failed to send reminder to ${user.email}`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      logger.error(`❌ Failed to process ${days}-day reminders`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Process expired subscriptions
   */
  private async processExpiredSubscriptions(): Promise<void> {
    try {
      // Find users whose subscriptions just expired (within last 24 hours)
      const expiredUsers = await this.database.query(`
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.subscription_tier_id,
          u.subscription_expires_at
        FROM users u
        WHERE u.role = 'tradesperson'
          AND u.subscription_tier_id IN ('normal', 'pro')
          AND u.subscription_status = 'active'
          AND u.subscription_expires_at IS NOT NULL
          AND u.subscription_expires_at < NOW()
          AND u.subscription_expires_at > NOW() - INTERVAL '24 hours'
          AND u.email IS NOT NULL
          AND u.email != ''
      `);

      if (!expiredUsers || expiredUsers.length === 0) {
        logger.info('📧 No newly expired subscriptions to process');
        return;
      }

      logger.info(`📧 Found ${expiredUsers.length} newly expired subscriptions`);

      for (const user of expiredUsers) {
        try {
          // Check if we already sent an expiry notification
          const existingNotification = await this.database.query(`
            SELECT id FROM email_logs 
            WHERE user_id = $1 
              AND email_type = 'subscription_expired'
              AND created_at > NOW() - INTERVAL '7 days'
          `, [user.id]);

          if (existingNotification && existingNotification.length > 0) {
            continue;
          }

          // Update subscription status
          await this.database.query(`
            UPDATE users 
            SET subscription_status = 'expired', updated_at = NOW()
            WHERE id = $1
          `, [user.id]);

          // Disable SMS for expired subscriptions
          await this.database.query(`
            UPDATE sms_settings 
            SET is_enabled = FALSE, updated_at = NOW()
            WHERE user_id = $1
          `, [user.id]);

          // Send expiry notification
          await EmailService.sendSubscriptionExpiredEmail(
            user.email,
            user.first_name || 'Потребител',
            user.subscription_tier_id,
            user.id
          );

          logger.info(`📧 Sent subscription expired notification to ${user.email}`);
        } catch (error) {
          logger.error(`❌ Failed to process expired subscription for ${user.email}`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      logger.error('❌ Failed to process expired subscriptions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Run manually for testing
   */
  public async runManually(): Promise<{ reminders: number; expired: number }> {
    logger.info('🔧 Running subscription reminder job manually...');
    await this.processSubscriptionReminders();
    return { reminders: 0, expired: 0 }; // Return actual counts if needed
  }
}

export default SubscriptionReminderService.getInstance();
