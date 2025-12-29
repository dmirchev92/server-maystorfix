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
   * Uses granular budget ranges for fair point allocation (up to 10k BGN)
   * Ranges start from X01 (e.g., 251, 501, 1001, etc.)
   * Only winning bidders pay points
   */
  calculatePointsCost(budget: number, tierLimits: TierLimits): number {
    if (budget <= 250) {
      return tierLimits.points_cost_1_250 || 0;
    } else if (budget <= 500) {
      return tierLimits.points_cost_251_500 || 0;
    } else if (budget <= 750) {
      return tierLimits.points_cost_501_750 || 0;
    } else if (budget <= 1000) {
      return tierLimits.points_cost_751_1000 || 0;
    } else if (budget <= 2000) {
      return tierLimits.points_cost_1001_2000 || 0;
    } else if (budget <= 3000) {
      return tierLimits.points_cost_2001_3000 || 0;
    } else if (budget <= 4000) {
      return tierLimits.points_cost_3001_4000 || 0;
    } else if (budget <= 5000) {
      return tierLimits.points_cost_4001_5000 || 0;
    } else if (budget <= 6000) {
      return tierLimits.points_cost_5001_6000 || 0;
    } else if (budget <= 7000) {
      return tierLimits.points_cost_6001_7000 || 0;
    } else if (budget <= 8000) {
      return tierLimits.points_cost_7001_8000 || 0;
    } else if (budget <= 9000) {
      return tierLimits.points_cost_8001_9000 || 0;
    } else if (budget <= 10000) {
      return tierLimits.points_cost_9001_10000 || 0;
    }
    
    // For budgets over 10000, use the highest tier cost
    return tierLimits.points_cost_9001_10000 || 0;
  }

  /**
   * Get budget range string for display
   */
  getBudgetRange(budget: number): string {
    if (budget <= 250) return '1-250 лв';
    if (budget <= 500) return '251-500 лв';
    if (budget <= 750) return '501-750 лв';
    if (budget <= 1000) return '751-1000 лв';
    if (budget <= 2000) return '1001-2000 лв';
    if (budget <= 3000) return '2001-3000 лв';
    if (budget <= 4000) return '3001-4000 лв';
    if (budget <= 5000) return '4001-5000 лв';
    if (budget <= 6000) return '5001-6000 лв';
    if (budget <= 7000) return '6001-7000 лв';
    if (budget <= 8000) return '7001-8000 лв';
    if (budget <= 9000) return '8001-9000 лв';
    if (budget <= 10000) return '9001-10000 лв';
    return '10000+ лв';
  }

  /**
   * Get extra points purchase price for a tier
   * Returns null if tier cannot purchase extra points
   */
  async getExtraPointsPrice(userId: string): Promise<number | null> {
    try {
      const query = `
        SELECT st.limits->>'extra_points_price' as extra_points_price
        FROM users u
        LEFT JOIN subscription_tiers st ON u.subscription_tier_id = st.id
        WHERE u.id = $1
      `;
      const rows = await this.database.query(query, [userId]);
      
      if (rows.length === 0) {
        return null;
      }

      const price = rows[0].extra_points_price;
      return price ? parseFloat(price) : null;
    } catch (error) {
      logger.error('Failed to get extra points price', { userId, error });
      throw error;
    }
  }

  /**
   * Calculate cost to purchase extra points
   */
  async calculateExtraPointsCost(userId: string, pointsAmount: number): Promise<{ price: number; canPurchase: boolean; message?: string }> {
    const pricePerPoint = await this.getExtraPointsPrice(userId);
    
    if (pricePerPoint === null) {
      return {
        price: 0,
        canPurchase: false,
        message: 'Your tier does not allow purchasing extra points. Please upgrade to NORMAL or PRO.'
      };
    }

    return {
      price: pricePerPoint * pointsAmount,
      canPurchase: true
    };
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
          u.subscription_tier_id,
          st.limits->>'points_monthly' as monthly_allowance,
          st.limits->>'points_yearly_included' as yearly_allowance
        FROM users u
        LEFT JOIN subscription_tiers st ON u.subscription_tier_id = st.id
        WHERE u.id = $1
      `;
      
      const rows = await this.database.query(query, [userId]);
      
      if (rows.length === 0) {
        throw new SubscriptionError('User not found', 'USER_NOT_FOUND', 404);
      }

      const row = rows[0];
      const yearlyAllowance = parseInt(row.yearly_allowance || '0');
      return {
        current_balance: row.points_balance || 0,
        total_earned: row.points_total_earned || 0,
        total_spent: row.points_total_spent || 0,
        last_reset: row.points_last_reset,
        monthly_allowance: yearlyAllowance, // For backward compat, set to yearly value
        yearly_allowance: yearlyAllowance,
        subscription_tier: row.subscription_tier_id || 'free'
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
   * Reset yearly points for all users (called on subscription renewal)
   * Note: With yearly subscriptions, this is typically called per-user on renewal,
   * not as a batch operation. Kept for backward compatibility.
   */
  async resetYearlyPoints(): Promise<void> {
    try {
      const query = `
        UPDATE users u
        SET 
          points_balance = (
            SELECT COALESCE((st.limits->>'points_yearly_included')::INTEGER, (st.limits->>'points_monthly')::INTEGER, 0)
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
          reason: 'Yearly points reset'
        });
      }

      logger.info('Yearly points reset completed', { usersUpdated: rows.length });
    } catch (error) {
      logger.error('Failed to reset yearly points', { error });
      throw error;
    }
  }

  /**
   * @deprecated Use resetYearlyPoints instead
   */
  async resetMonthlyPoints(): Promise<void> {
    return this.resetYearlyPoints();
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
  // POINTS TOP-UP / PURCHASE METHODS
  // ============================================================================

  /**
   * Points packages with volume discounts
   * Discount increases with package size
   */
  private readonly POINTS_PACKAGES = [
    { points: 150, discount: 0, label: '150 точки' },
    { points: 250, discount: 0.05, label: '250 точки (5% отстъпка)' },
    { points: 500, discount: 0.10, label: '500 точки (10% отстъпка)' },
    { points: 750, discount: 0.15, label: '750 точки (15% отстъпка)' },
    { points: 1000, discount: 0.20, label: '1000 точки (20% отстъпка)' },
    { points: 1500, discount: 0.25, label: '1500 точки (25% отстъпка)' },
    { points: 2000, discount: 0.30, label: '2000 точки (30% отстъпка)' },
  ];

  /**
   * Get available top-up options for user's tier
   */
  async getTopupOptions(userId: string): Promise<{
    canPurchase: boolean;
    pricePerPoint: number | null;
    currency: string;
    tier: string;
    packages: Array<{ 
      points: number; 
      basePrice: number;
      discount: number;
      discountPercent: number;
      finalPrice: number;
      savings: number;
      label: string;
      pricePerPoint: number;
    }>;
    message?: string;
  }> {
    try {
      // Get user's tier and extra_points_price
      const query = `
        SELECT 
          u.subscription_tier_id as tier,
          st.limits->>'extra_points_price' as price_per_point
        FROM users u
        LEFT JOIN subscription_tiers st ON u.subscription_tier_id = st.id
        WHERE u.id = $1
      `;
      const rows = await this.database.query(query, [userId]);
      
      if (rows.length === 0) {
        throw new SubscriptionError('User not found', 'USER_NOT_FOUND', 404);
      }

      const tier = rows[0].tier;
      const pricePerPoint = rows[0].price_per_point ? parseFloat(rows[0].price_per_point) : null;

      if (pricePerPoint === null) {
        return {
          canPurchase: false,
          pricePerPoint: null,
          currency: 'BGN',
          tier,
          packages: [],
          message: 'Your tier does not allow purchasing extra points. Please upgrade to NORMAL or PRO.'
        };
      }

      // Generate packages with discounts
      const packages = this.POINTS_PACKAGES.map(pkg => {
        const basePrice = Math.round(pkg.points * pricePerPoint * 100) / 100;
        const discountAmount = Math.round(basePrice * pkg.discount * 100) / 100;
        const finalPrice = Math.round((basePrice - discountAmount) * 100) / 100;
        const effectivePricePerPoint = Math.round((finalPrice / pkg.points) * 100) / 100;
        
        return {
          points: pkg.points,
          basePrice,
          discount: discountAmount,
          discountPercent: Math.round(pkg.discount * 100),
          finalPrice,
          savings: discountAmount,
          label: pkg.label,
          pricePerPoint: effectivePricePerPoint
        };
      });

      return {
        canPurchase: true,
        pricePerPoint,
        currency: 'BGN',
        tier,
        packages
      };
    } catch (error) {
      logger.error('Failed to get topup options', { userId, error });
      throw error;
    }
  }

  /**
   * Get package details by points amount
   */
  getPackageByPoints(points: number): { discount: number; label: string } | null {
    return this.POINTS_PACKAGES.find(pkg => pkg.points === points) || null;
  }

  /**
   * Purchase additional points (manual payment flow)
   * Supports package discounts for predefined packages
   */
  async purchasePoints(
    userId: string, 
    points: number, 
    paymentReference?: string
  ): Promise<{
    pointsAdded: number;
    basePrice: number;
    discount: number;
    discountPercent: number;
    totalPrice: number;
    newBalance: number;
    transactionId: string;
  }> {
    try {
      // Get topup options to validate purchase
      const options = await this.getTopupOptions(userId);
      
      if (!options.canPurchase || options.pricePerPoint === null) {
        throw new SubscriptionError(
          options.message || 'Cannot purchase points with current tier',
          'PURCHASE_NOT_ALLOWED',
          403
        );
      }

      // Check if this is a predefined package (with discount)
      const pkg = this.getPackageByPoints(points);
      const basePrice = Math.round(points * options.pricePerPoint * 100) / 100;
      const discountPercent = pkg ? Math.round(pkg.discount * 100) : 0;
      const discountAmount = pkg ? Math.round(basePrice * pkg.discount * 100) / 100 : 0;
      const totalPrice = Math.round((basePrice - discountAmount) * 100) / 100;
      const transactionId = uuidv4();

      // Add points to user balance
      const updateQuery = `
        UPDATE users 
        SET 
          points_balance = points_balance + $1,
          points_total_earned = points_total_earned + $1
        WHERE id = $2
        RETURNING points_balance
      `;
      const updateRows = await this.database.query(updateQuery, [points, userId]);
      const newBalance = updateRows[0].points_balance;

      // Record transaction
      await this.recordTransaction({
        user_id: userId,
        transaction_type: 'earned',
        points_amount: points,
        balance_after: newBalance,
        reason: `Points purchased (${points} pts for ${totalPrice} лв${discountPercent > 0 ? `, ${discountPercent}% отстъпка` : ''})`,
        metadata: {
          purchase: true,
          package: pkg ? true : false,
          base_price: basePrice,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          total_price: totalPrice,
          price_per_point: options.pricePerPoint,
          payment_reference: paymentReference,
          tier: options.tier
        }
      });

      logger.info('Points purchased successfully', {
        userId,
        points,
        basePrice,
        discountPercent,
        totalPrice,
        newBalance,
        paymentReference
      });

      return {
        pointsAdded: points,
        basePrice,
        discount: discountAmount,
        discountPercent,
        totalPrice,
        newBalance,
        transactionId
      };
    } catch (error) {
      logger.error('Failed to purchase points', { userId, points, error });
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
