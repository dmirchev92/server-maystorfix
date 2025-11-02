/**
 * SMS Limit Service
 * Manages SMS limits for NORMAL tier users (15 SMS/month with purchase option)
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import { SubscriptionService } from './SubscriptionService';
import { SubscriptionTier, SPSMSPackage } from '../types/subscription';
import logger from '../utils/logger';

export interface SMSLimitStatus {
  canSend: boolean;
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  addonRemaining: number;
  totalRemaining: number;
  tier: SubscriptionTier;
  periodStart: Date;
  periodEnd: Date;
  reason?: string;
}

export interface SMSPackagePurchaseRequest {
  user_id: string;
  package_type?: string; // Default: 'addon_15'
  payment_method?: string;
  payment_reference?: string;
}

export class SMSLimitService {
  private database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;
  private subscriptionService = new SubscriptionService();

  /**
   * Check if user can send SMS and get current usage
   */
  async checkSMSLimit(userId: string): Promise<SMSLimitStatus> {
    try {
      // Get user's tier
      const tier = await this.subscriptionService.getUserTier(userId);
      const tierData = await this.subscriptionService.getTierById(tier);

      if (!tierData) {
        throw new Error('User tier not found');
      }

      const monthlyLimit = tierData.limits.monthly_sms_limit || 0;

      // FREE tier users can't send SMS (handled by trial system)
      if (tier === SubscriptionTier.FREE) {
        return {
          canSend: false,
          monthlyLimit: 0,
          monthlyUsed: 0,
          monthlyRemaining: 0,
          addonRemaining: 0,
          totalRemaining: 0,
          tier,
          periodStart: new Date(),
          periodEnd: new Date(),
          reason: 'FREE tier users cannot send SMS. Please upgrade to NORMAL or PRO.'
        };
      }

      // NORMAL and PRO tiers - check monthly limit and addon packages
      const smsSettings = await this.getSMSSettings(userId);
      
      // Check if we need to reset monthly counter
      const now = new Date();
      const periodStart = smsSettings.monthly_period_start || new Date();
      const currentMonth = now.getMonth();
      const settingsMonth = periodStart.getMonth();

      let monthlyUsed = smsSettings.monthly_sms_count || 0;
      let addonRemaining = smsSettings.addon_sms_remaining || 0;

      // Reset monthly counter if new month
      if (currentMonth !== settingsMonth) {
        await this.resetMonthlyCounter(userId);
        monthlyUsed = 0;
      }

      const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);
      const totalRemaining = monthlyRemaining + addonRemaining;

      // Calculate period end (end of current month)
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      return {
        canSend: totalRemaining > 0,
        monthlyLimit,
        monthlyUsed,
        monthlyRemaining,
        addonRemaining,
        totalRemaining,
        tier,
        periodStart: new Date(periodStart),
        periodEnd,
        reason: totalRemaining === 0 ? 'SMS limit reached. Purchase additional SMS to continue.' : undefined
      };

    } catch (error) {
      logger.error('Error checking SMS limit', { userId, error });
      throw error;
    }
  }

  /**
   * Increment SMS usage counter
   */
  async incrementSMSUsage(userId: string): Promise<void> {
    try {
      const status = await this.checkSMSLimit(userId);

      if (!status.canSend) {
        throw new Error('SMS limit exceeded');
      }

      // Use addon SMS first, then monthly allowance
      if (status.addonRemaining > 0) {
        // Decrement addon SMS
        await this.database.query(
          `UPDATE sms_settings 
           SET addon_sms_remaining = addon_sms_remaining - 1,
               updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );

        // Update addon package usage
        await this.decrementAddonPackage(userId);
      } else {
        // Increment monthly counter
        await this.database.query(
          `UPDATE sms_settings 
           SET monthly_sms_count = monthly_sms_count + 1,
               updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );
      }

      logger.info('SMS usage incremented', { userId });

    } catch (error) {
      logger.error('Error incrementing SMS usage', { userId, error });
      throw error;
    }
  }

  /**
   * Purchase SMS addon package (15 SMS for 40 BGN)
   */
  async purchaseSMSPackage(request: SMSPackagePurchaseRequest): Promise<SPSMSPackage> {
    const { user_id, package_type = 'addon_15', payment_method, payment_reference } = request;

    try {
      // Verify user is NORMAL or PRO tier
      const tier = await this.subscriptionService.getUserTier(user_id);
      if (tier !== SubscriptionTier.NORMAL && tier !== SubscriptionTier.PRO) {
        throw new Error('SMS packages are only available for NORMAL and PRO tier users');
      }

      // Create package record
      const packageId = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO sp_sms_packages (
          id, user_id, package_type, sms_count, price, currency,
          purchased_at, sms_used, sms_remaining, status,
          payment_method, payment_reference
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const rows = await this.database.query(query, [
        packageId,
        user_id,
        package_type,
        15, // sms_count
        40.00, // price
        'BGN',
        now,
        0, // sms_used
        15, // sms_remaining
        'active',
        payment_method || null,
        payment_reference || null
      ]);

      // Add 15 SMS to user's addon balance
      await this.database.query(
        `UPDATE sms_settings 
         SET addon_sms_remaining = addon_sms_remaining + 15,
             updated_at = NOW()
         WHERE user_id = $1`,
        [user_id]
      );

      logger.info('SMS package purchased', {
        userId: user_id,
        packageId,
        smsCount: 15,
        price: 40
      });

      return this.mapSMSPackageRow(rows[0]);

    } catch (error) {
      logger.error('Error purchasing SMS package', { userId: user_id, error });
      throw error;
    }
  }

  /**
   * Get user's SMS package history
   */
  async getSMSPackages(userId: string): Promise<SPSMSPackage[]> {
    try {
      const query = `
        SELECT * FROM sp_sms_packages 
        WHERE user_id = $1 
        ORDER BY purchased_at DESC
      `;
      const rows = await this.database.query(query, [userId]);
      return rows.map(row => this.mapSMSPackageRow(row));
    } catch (error) {
      logger.error('Error fetching SMS packages', { userId, error });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async getSMSSettings(userId: string): Promise<any> {
    const query = `
      SELECT monthly_sms_count, monthly_period_start, addon_sms_remaining
      FROM sms_settings 
      WHERE user_id = $1
    `;
    const rows = await this.database.query(query, [userId]);
    
    if (rows.length === 0) {
      // Create default settings
      await this.database.query(
        `INSERT INTO sms_settings (id, user_id, monthly_sms_count, monthly_period_start, addon_sms_remaining)
         VALUES (gen_random_uuid(), $1, 0, DATE_TRUNC('month', CURRENT_TIMESTAMP), 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      return {
        monthly_sms_count: 0,
        monthly_period_start: new Date(),
        addon_sms_remaining: 0
      };
    }

    return rows[0];
  }

  private async resetMonthlyCounter(userId: string): Promise<void> {
    await this.database.query(
      `UPDATE sms_settings 
       SET monthly_sms_count = 0,
           monthly_period_start = DATE_TRUNC('month', CURRENT_TIMESTAMP),
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    logger.info('Monthly SMS counter reset', { userId });
  }

  private async decrementAddonPackage(userId: string): Promise<void> {
    // Find the oldest active package with remaining SMS
    const query = `
      UPDATE sp_sms_packages 
      SET sms_used = sms_used + 1,
          sms_remaining = sms_remaining - 1,
          status = CASE WHEN sms_remaining - 1 = 0 THEN 'depleted' ELSE status END,
          updated_at = NOW()
      WHERE id = (
        SELECT id FROM sp_sms_packages
        WHERE user_id = $1 AND status = 'active' AND sms_remaining > 0
        ORDER BY purchased_at ASC
        LIMIT 1
      )
    `;
    await this.database.query(query, [userId]);
  }

  private mapSMSPackageRow(row: any): SPSMSPackage {
    return {
      id: row.id,
      user_id: row.user_id,
      package_type: row.package_type,
      sms_count: row.sms_count,
      price: parseFloat(row.price),
      currency: row.currency,
      purchased_at: row.purchased_at,
      expires_at: row.expires_at,
      sms_used: row.sms_used,
      sms_remaining: row.sms_remaining,
      status: row.status,
      payment_method: row.payment_method,
      payment_reference: row.payment_reference,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export default new SMSLimitService();
