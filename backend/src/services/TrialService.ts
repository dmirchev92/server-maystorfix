/**
 * Trial Service
 * Manages FREE tier trial limits: 5 case ACCEPTANCES OR 14 days
 * Note: Service Providers ACCEPT cases from customers (not create them)
 */

import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import logger from '../utils/logger';

const TRIAL_MAX_CASES = 5;
const TRIAL_MAX_DAYS = 14;

export interface TrialStatus {
  isActive: boolean;
  isExpired: boolean;
  casesUsed: number;
  casesRemaining: number;
  daysRemaining: number;
  expiresAt: Date | null;
  reason?: 'cases_limit' | 'time_limit' | 'not_free_tier';
}

export class TrialService {
  private database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;

  /**
   * Check if user's trial is still active
   */
  async checkTrialStatus(userId: string): Promise<TrialStatus> {
    try {
      const query = `
        SELECT 
          subscription_tier_id,
          trial_started_at,
          trial_cases_used,
          trial_expired
        FROM users 
        WHERE id = $1
      `;
      
      const rows = await this.database.query(query, [userId]);
      
      if (rows.length === 0) {
        throw new Error('User not found');
      }

      const user = rows[0];

      // Not a FREE tier user - no trial restrictions
      if (user.subscription_tier_id !== 'free') {
        return {
          isActive: true,
          isExpired: false,
          casesUsed: 0,
          casesRemaining: Infinity,
          daysRemaining: Infinity,
          expiresAt: null,
          reason: 'not_free_tier'
        };
      }

      // Check if already marked as expired
      if (user.trial_expired) {
        return {
          isActive: false,
          isExpired: true,
          casesUsed: user.trial_cases_used || 0,
          casesRemaining: 0,
          daysRemaining: 0,
          expiresAt: null
        };
      }

      const trialStartedAt = user.trial_started_at ? new Date(user.trial_started_at) : null;
      const casesUsed = user.trial_cases_used || 0;

      if (!trialStartedAt) {
        // Trial not started yet - shouldn't happen but handle gracefully
        return {
          isActive: true,
          isExpired: false,
          casesUsed: 0,
          casesRemaining: TRIAL_MAX_CASES,
          daysRemaining: TRIAL_MAX_DAYS,
          expiresAt: null
        };
      }

      // Calculate days elapsed
      const now = new Date();
      const daysElapsed = Math.floor((now.getTime() - trialStartedAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, TRIAL_MAX_DAYS - daysElapsed);
      
      // Calculate expiration date
      const expiresAt = new Date(trialStartedAt);
      expiresAt.setDate(expiresAt.getDate() + TRIAL_MAX_DAYS);

      // Check if trial expired by cases
      if (casesUsed >= TRIAL_MAX_CASES) {
        await this.markTrialAsExpired(userId);
        return {
          isActive: false,
          isExpired: true,
          casesUsed,
          casesRemaining: 0,
          daysRemaining,
          expiresAt,
          reason: 'cases_limit'
        };
      }

      // Check if trial expired by time
      if (daysElapsed >= TRIAL_MAX_DAYS) {
        await this.markTrialAsExpired(userId);
        return {
          isActive: false,
          isExpired: true,
          casesUsed,
          casesRemaining: TRIAL_MAX_CASES - casesUsed,
          daysRemaining: 0,
          expiresAt,
          reason: 'time_limit'
        };
      }

      // Trial still active
      return {
        isActive: true,
        isExpired: false,
        casesUsed,
        casesRemaining: TRIAL_MAX_CASES - casesUsed,
        daysRemaining,
        expiresAt
      };

    } catch (error) {
      logger.error('Error checking trial status', { userId, error });
      throw error;
    }
  }

  /**
   * Increment trial cases used (when SP accepts a case)
   */
  async incrementTrialCases(userId: string): Promise<void> {
    try {
      await this.database.query(
        `UPDATE users 
         SET trial_cases_used = COALESCE(trial_cases_used, 0) + 1,
             updated_at = NOW()
         WHERE id = $1 AND subscription_tier_id = 'free'`,
        [userId]
      );

      logger.info('Trial case incremented', { userId });

      // Check if trial should be expired now
      await this.checkTrialStatus(userId);

    } catch (error) {
      logger.error('Error incrementing trial cases', { userId, error });
      throw error;
    }
  }

  /**
   * Mark trial as expired
   */
  private async markTrialAsExpired(userId: string): Promise<void> {
    try {
      await this.database.query(
        `UPDATE users 
         SET trial_expired = TRUE,
             updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );

      logger.info('Trial marked as expired', { userId });

    } catch (error) {
      logger.error('Error marking trial as expired', { userId, error });
      throw error;
    }
  }

  /**
   * Reset trial (admin function)
   */
  async resetTrial(userId: string): Promise<void> {
    try {
      await this.database.query(
        `UPDATE users 
         SET trial_started_at = NOW(),
             trial_cases_used = 0,
             trial_expired = FALSE,
             updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );

      logger.info('Trial reset', { userId });

    } catch (error) {
      logger.error('Error resetting trial', { userId, error });
      throw error;
    }
  }
}

export default new TrialService();
