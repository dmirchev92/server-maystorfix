/**
 * SMS Points Service
 * SMS is unlimited but costs points:
 * - FREE: 2 points per SMS (cannot send if no points)
 * - NORMAL: 2 points per SMS
 * - PRO: 1 point per SMS
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import { SubscriptionService } from './SubscriptionService';
import { SubscriptionTier } from '../types/subscription';
import logger from '../utils/logger';

// Default SMS points cost by tier (fallback if not in DB)
const DEFAULT_SMS_POINTS_COST = {
  [SubscriptionTier.FREE]: 2,    // 2 points per SMS
  [SubscriptionTier.NORMAL]: 2,  // 2 points per SMS
  [SubscriptionTier.PRO]: 1      // 1 point per SMS
};

export interface SMSPointsStatus {
  canSend: boolean;
  pointsCost: number;
  pointsBalance: number;
  tier: SubscriptionTier;
  reason?: string;
}

export class SMSLimitService {
  private database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;
  private subscriptionService = new SubscriptionService();

  /**
   * Get SMS points cost for a tier (from DB or fallback)
   */
  async getSMSPointsCostFromDB(tier: SubscriptionTier): Promise<number> {
    try {
      const query = `SELECT limits->>'sms_points_cost' as sms_cost FROM subscription_tiers WHERE id = $1`;
      const rows = await this.database.query(query, [tier]);
      if (rows.length > 0 && rows[0].sms_cost) {
        return parseInt(rows[0].sms_cost);
      }
    } catch (error) {
      logger.warn('Could not fetch SMS cost from DB, using default', { tier, error });
    }
    return DEFAULT_SMS_POINTS_COST[tier] || 2;
  }

  /**
   * Get SMS points cost for a tier (sync fallback)
   */
  getSMSPointsCost(tier: SubscriptionTier): number {
    return DEFAULT_SMS_POINTS_COST[tier] || 2;
  }

  /**
   * Check if user can send SMS based on points balance
   */
  async checkSMSLimit(userId: string): Promise<SMSPointsStatus> {
    try {
      // Get user's tier
      const tier = await this.subscriptionService.getUserTier(userId);

      // Get SMS cost from DB (tier-based: Normal=2, Pro=1)
      const pointsCost = await this.getSMSPointsCostFromDB(tier);

      // Get user's points balance
      const pointsQuery = `SELECT points_balance FROM users WHERE id = $1`;
      const pointsRows = await this.database.query(pointsQuery, [userId]);
      
      if (pointsRows.length === 0) {
        throw new Error('User not found');
      }

      const pointsBalance = pointsRows[0].points_balance || 0;

      // Check if user has enough points
      const canSend = pointsBalance >= pointsCost;

      return {
        canSend,
        pointsCost,
        pointsBalance,
        tier,
        reason: canSend ? undefined : `Insufficient points. You need ${pointsCost} points to send an SMS. Current balance: ${pointsBalance}`
      };

    } catch (error) {
      logger.error('Error checking SMS points', { userId, error });
      throw error;
    }
  }

  /**
   * Deduct points for sending SMS
   */
  async incrementSMSUsage(userId: string): Promise<void> {
    try {
      const status = await this.checkSMSLimit(userId);

      if (!status.canSend) {
        throw new Error(status.reason || 'Cannot send SMS');
      }

      const pointsCost = status.pointsCost;

      // Deduct points from user
      const updateQuery = `
        UPDATE users 
        SET 
          points_balance = points_balance - $1,
          points_total_spent = points_total_spent + $1
        WHERE id = $2
        RETURNING points_balance
      `;
      const updateRows = await this.database.query(updateQuery, [pointsCost, userId]);
      const newBalance = updateRows[0].points_balance;

      // Record transaction
      const transactionQuery = `
        INSERT INTO sp_points_transactions (
          id, user_id, transaction_type, points_amount, balance_after, 
          reason, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await this.database.query(transactionQuery, [
        uuidv4(),
        userId,
        'spent',
        pointsCost,
        newBalance,
        'SMS sent',
        JSON.stringify({ action: 'sms_sent', tier: status.tier })
      ]);

      logger.info('Points deducted for SMS', { 
        userId, 
        pointsCost, 
        newBalance,
        tier: status.tier
      });

    } catch (error) {
      logger.error('Error deducting SMS points', { userId, error });
      throw error;
    }
  }

  /**
   * Get SMS statistics for user (for backward compatibility)
   */
  async getSMSStats(userId: string): Promise<{
    totalSent: number;
    pointsSpentOnSMS: number;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_sent,
          COALESCE(SUM(points_amount), 0) as points_spent
        FROM sp_points_transactions
        WHERE user_id = $1 AND reason = 'SMS sent'
      `;
      const rows = await this.database.query(query, [userId]);
      
      return {
        totalSent: parseInt(rows[0]?.total_sent || '0'),
        pointsSpentOnSMS: parseInt(rows[0]?.points_spent || '0')
      };
    } catch (error) {
      logger.error('Error getting SMS stats', { userId, error });
      return { totalSent: 0, pointsSpentOnSMS: 0 };
    }
  }
}

export default new SMSLimitService();
