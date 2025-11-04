/**
 * Points Service
 * Manages points system for case access based on subscription tiers
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import logger from '../utils/logger';
import {
  SubscriptionTier,
  TierLimits,
  SPPointsTransaction,
  SPCaseAccess,
  PointsBalance,
  CaseAccessRequest,
  CaseAccessResult,
  SubscriptionError
} from '../types/subscription';

export class PointsService {
  private database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;

  /**
   * Calculate points cost for a case based on budget and tier
   */
  calculatePointsCost(budget: number, tierLimits: TierLimits): number {
    if (budget <= 500) {
      return tierLimits.points_cost_1_500;
    } else if (budget <= 1000) {
      return tierLimits.points_cost_500_1000;
    } else if (budget <= 1500) {
      return tierLimits.points_cost_1000_1500;
    } else if (budget <= 2000) {
      return tierLimits.points_cost_1500_2000;
    } else if (budget <= 3000) {
      return tierLimits.points_cost_2000_3000;
    } else if (budget <= 4000) {
      return tierLimits.points_cost_3000_4000;
    } else if (budget <= 5000) {
      return tierLimits.points_cost_4000_5000;
    }
    
    // For budgets over 5000, use the highest tier cost
    return tierLimits.points_cost_4000_5000;
  }

  /**
   * Get budget range string for display
   */
  getBudgetRange(budget: number): string {
    if (budget <= 500) return '1-500 BGN';
    if (budget <= 1000) return '500-1000 BGN';
    if (budget <= 1500) return '1000-1500 BGN';
    if (budget <= 2000) return '1500-2000 BGN';
    if (budget <= 3000) return '2000-3000 BGN';
    if (budget <= 4000) return '3000-4000 BGN';
    if (budget <= 5000) return '4000-5000 BGN';
    return '5000+ BGN';
  }

  /**
   * Get user's current points balance
   */
  async getPointsBalance(userId: string): Promise<PointsBalance> {
    try {
      const query = `
        SELECT 
          u.points_balance,
          u.points_total_earned,
          u.points_total_spent,
          u.points_last_reset,
          st.limits->>'points_monthly' as monthly_allowance
        FROM users u
        LEFT JOIN subscription_tiers st ON u.subscription_tier_id = st.id
        WHERE u.id = $1
      `;
      
      const rows = await this.database.query(query, [userId]);
      
      if (rows.length === 0) {
        throw new SubscriptionError('User not found', 'USER_NOT_FOUND', 404);
      }

      const row = rows[0];
      return {
        current_balance: row.points_balance || 0,
        total_earned: row.points_total_earned || 0,
        total_spent: row.points_total_spent || 0,
        last_reset: row.points_last_reset,
        monthly_allowance: parseInt(row.monthly_allowance || '0')
      };
    } catch (error) {
      logger.error('Failed to get points balance', { userId, error });
      throw error;
    }
  }

  /**
   * Check if user can access a case based on points and tier limits
   */
  async checkCaseAccess(request: CaseAccessRequest): Promise<CaseAccessResult> {
    const { user_id, case_id, case_budget } = request;

    try {
      // Check if user already accessed this case
      const accessQuery = `
        SELECT id FROM sp_case_access 
        WHERE user_id = $1 AND case_id = $2
      `;
      const accessRows = await this.database.query(accessQuery, [user_id, case_id]);
      
      if (accessRows.length > 0) {
        return {
          allowed: true,
          points_required: 0,
          points_balance: 0,
          message: 'Case already accessed'
        };
      }

      // Get user's tier and limits
      const tierQuery = `
        SELECT st.limits, u.points_balance
        FROM users u
        LEFT JOIN subscription_tiers st ON u.subscription_tier_id = st.id
        WHERE u.id = $1
      `;
      const tierRows = await this.database.query(tierQuery, [user_id]);
      
      if (tierRows.length === 0) {
        throw new SubscriptionError('User not found', 'USER_NOT_FOUND', 404);
      }

      const { limits, points_balance } = tierRows[0];
      const tierLimits = limits as TierLimits;

      // Check if case budget exceeds tier's max budget
      if (case_budget > tierLimits.max_case_budget) {
        return {
          allowed: false,
          points_required: 0,
          points_balance: points_balance || 0,
          message: `Case budget (${case_budget} BGN) exceeds your tier limit (${tierLimits.max_case_budget} BGN). Upgrade to access higher budget cases.`,
          case_budget_range: this.getBudgetRange(case_budget)
        };
      }

      // Calculate points required
      const pointsRequired = this.calculatePointsCost(case_budget, tierLimits);

      // Check if points cost is 0 (tier doesn't support this budget range)
      if (pointsRequired === 0) {
        return {
          allowed: false,
          points_required: 0,
          points_balance: points_balance || 0,
          message: `Your tier does not support cases in this budget range. Please upgrade.`,
          case_budget_range: this.getBudgetRange(case_budget)
        };
      }

      // Check if user has enough points
      if (points_balance < pointsRequired) {
        return {
          allowed: false,
          points_required: pointsRequired,
          points_balance: points_balance || 0,
          message: `Insufficient points. Required: ${pointsRequired}, Available: ${points_balance}`,
          case_budget_range: this.getBudgetRange(case_budget)
        };
      }

      return {
        allowed: true,
        points_required: pointsRequired,
        points_balance: points_balance || 0,
        case_budget_range: this.getBudgetRange(case_budget)
      };
    } catch (error) {
      logger.error('Failed to check case access', { userId: user_id, caseId: case_id, error });
      throw error;
    }
  }

  /**
   * Spend points to access a case
   */
  async spendPointsForCase(request: CaseAccessRequest): Promise<SPCaseAccess> {
    const { user_id, case_id, case_budget } = request;

    try {
      // Check access first
      const accessCheck = await this.checkCaseAccess(request);
      
      if (!accessCheck.allowed) {
        throw new SubscriptionError(
          accessCheck.message || 'Cannot access case',
          'CASE_ACCESS_DENIED',
          403
        );
      }

      // If already accessed, return existing record
      if (accessCheck.message === 'Case already accessed') {
        const existingQuery = `
          SELECT * FROM sp_case_access 
          WHERE user_id = $1 AND case_id = $2
        `;
        const existingRows = await this.database.query(existingQuery, [user_id, case_id]);
        return this.mapCaseAccessRow(existingRows[0]);
      }

      const pointsRequired = accessCheck.points_required;

      // Deduct points from user
      const updateQuery = `
        UPDATE users 
        SET 
          points_balance = points_balance - $1,
          points_total_spent = points_total_spent + $1
        WHERE id = $2
        RETURNING points_balance
      `;
      const updateRows = await this.database.query(updateQuery, [pointsRequired, user_id]);
      const newBalance = updateRows[0].points_balance;

      // Record case access
      const accessId = uuidv4();
      const insertAccessQuery = `
        INSERT INTO sp_case_access (id, user_id, case_id, points_spent, case_budget)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const accessRows = await this.database.query(insertAccessQuery, [
        accessId,
        user_id,
        case_id,
        pointsRequired,
        case_budget
      ]);

      // Record transaction
      await this.recordTransaction({
        user_id,
        transaction_type: 'spent',
        points_amount: pointsRequired,
        balance_after: newBalance,
        reason: `Accessed case ${case_id} (${this.getBudgetRange(case_budget)})`,
        case_id
      });

      logger.info('Points spent for case access', {
        userId: user_id,
        caseId: case_id,
        pointsSpent: pointsRequired,
        newBalance
      });

      return this.mapCaseAccessRow(accessRows[0]);
    } catch (error) {
      logger.error('Failed to spend points for case', { userId: user_id, caseId: case_id, error });
      throw error;
    }
  }

  /**
   * Award points to user (e.g., monthly reset, bonus)
   */
  async awardPoints(
    userId: string,
    points: number,
    reason: string,
    transactionType: 'earned' | 'bonus' | 'reset' = 'earned'
  ): Promise<PointsBalance> {
    try {
      const updateQuery = `
        UPDATE users 
        SET 
          points_balance = points_balance + $1,
          points_total_earned = points_total_earned + $1,
          points_last_reset = CASE WHEN $3 = 'reset' THEN CURRENT_TIMESTAMP ELSE points_last_reset END
        WHERE id = $2
        RETURNING points_balance
      `;
      const rows = await this.database.query(updateQuery, [points, userId, transactionType]);
      const newBalance = rows[0].points_balance;

      // Record transaction
      await this.recordTransaction({
        user_id: userId,
        transaction_type: transactionType,
        points_amount: points,
        balance_after: newBalance,
        reason
      });

      logger.info('Points awarded', { userId, points, reason, newBalance });

      return await this.getPointsBalance(userId);
    } catch (error) {
      logger.error('Failed to award points', { userId, points, error });
      throw error;
    }
  }

  /**
   * Reset monthly points for all users
   */
  async resetMonthlyPoints(): Promise<void> {
    try {
      const query = `
        UPDATE users u
        SET 
          points_balance = (
            SELECT (st.limits->>'points_monthly')::INTEGER
            FROM subscription_tiers st
            WHERE st.id = u.subscription_tier_id
          ),
          points_last_reset = CURRENT_TIMESTAMP
        WHERE role = 'tradesperson'
        RETURNING id, points_balance
      `;
      
      const rows = await this.database.query(query);
      
      // Record transactions for all users
      for (const row of rows) {
        await this.recordTransaction({
          user_id: row.id,
          transaction_type: 'reset',
          points_amount: row.points_balance,
          balance_after: row.points_balance,
          reason: 'Monthly points reset'
        });
      }

      logger.info('Monthly points reset completed', { usersUpdated: rows.length });
    } catch (error) {
      logger.error('Failed to reset monthly points', { error });
      throw error;
    }
  }

  /**
   * Get user's points transaction history
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SPPointsTransaction[]> {
    try {
      const query = `
        SELECT * FROM sp_points_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const rows = await this.database.query(query, [userId, limit, offset]);
      return rows.map(row => this.mapTransactionRow(row));
    } catch (error) {
      logger.error('Failed to get transaction history', { userId, error });
      throw error;
    }
  }

  /**
   * Get cases accessed by user
   */
  async getAccessedCases(userId: string): Promise<SPCaseAccess[]> {
    try {
      const query = `
        SELECT * FROM sp_case_access
        WHERE user_id = $1
        ORDER BY accessed_at DESC
      `;
      
      const rows = await this.database.query(query, [userId]);
      return rows.map(row => this.mapCaseAccessRow(row));
    } catch (error) {
      logger.error('Failed to get accessed cases', { userId, error });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async recordTransaction(data: Partial<SPPointsTransaction>): Promise<void> {
    const query = `
      INSERT INTO sp_points_transactions (
        id, user_id, transaction_type, points_amount, balance_after, 
        reason, case_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await this.database.query(query, [
      uuidv4(),
      data.user_id,
      data.transaction_type,
      data.points_amount,
      data.balance_after,
      data.reason,
      data.case_id || null,
      JSON.stringify(data.metadata || {})
    ]);
  }

  private mapTransactionRow(row: any): SPPointsTransaction {
    return {
      id: row.id,
      user_id: row.user_id,
      transaction_type: row.transaction_type,
      points_amount: row.points_amount,
      balance_after: row.balance_after,
      reason: row.reason,
      case_id: row.case_id,
      metadata: row.metadata,
      created_at: row.created_at
    };
  }

  private mapCaseAccessRow(row: any): SPCaseAccess {
    return {
      id: row.id,
      user_id: row.user_id,
      case_id: row.case_id,
      points_spent: row.points_spent,
      case_budget: parseFloat(row.case_budget),
      accessed_at: row.accessed_at
    };
  }
}

export default new PointsService();
