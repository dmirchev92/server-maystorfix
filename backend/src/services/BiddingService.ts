import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { PointsService } from './PointsService';

export interface CaseBid {
  id: string;
  case_id: string;
  provider_id: string;
  points_bid: number;
  bid_status: 'pending' | 'won' | 'lost' | 'refunded';
  bid_order: number;
  points_deducted: number;
  proposed_budget_range?: string;
  bid_comment?: string;
  participation_points?: number;
  created_at: Date;
  updated_at: Date;
}

export interface BidWithProvider extends CaseBid {
  provider_name: string;
  provider_email: string;
  provider_phone?: string;
  provider_rating?: number;
  provider_completed_cases?: number;
}

export interface BidPlacementResult {
  success: boolean;
  bid_id?: string;
  bid_order?: number;
  points_spent?: number;
  message: string;
}

export interface BidSelectionResult {
  success: boolean;
  winning_bid_id?: string;
  winner_provider_id?: string;
  message: string;
}

export class BiddingService {
  private pool: Pool;
  private pointsService: PointsService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.pointsService = new PointsService();
  }

  /**
   * Check if a provider can bid on a case
   */
  async canProviderBid(caseId: string, providerId: string): Promise<{ allowed: boolean; reason?: string; required_points?: number }> {
    const client = await this.pool.connect();
    
    try {
      // Get case details
      const caseResult = await client.query(`
        SELECT 
          c.*,
          u.subscription_tier_id
        FROM marketplace_service_cases c
        LEFT JOIN users u ON u.id = $2
        WHERE c.id = $1
      `, [caseId, providerId]);

      if (caseResult.rows.length === 0) {
        return { allowed: false, reason: 'Case not found' };
      }

      const caseData = caseResult.rows[0];

      // Check if provider is the customer
      if (caseData.customer_id === providerId) {
        return { allowed: false, reason: 'Cannot bid on your own case' };
      }

      // Check if bidding is enabled
      if (!caseData.bidding_enabled) {
        return { allowed: false, reason: 'Bidding is not enabled for this case' };
      }

      // Check if bidding is closed
      if (caseData.bidding_closed) {
        return { allowed: false, reason: 'Bidding is closed for this case' };
      }

      // Check if slots available
      if (caseData.current_bidders >= caseData.max_bidders) {
        return { allowed: false, reason: 'Maximum bidders reached' };
      }

      // Check if provider already bid
      const existingBid = await client.query(
        'SELECT id FROM sp_case_bids WHERE case_id = $1 AND provider_id = $2',
        [caseId, providerId]
      );

      if (existingBid.rows.length > 0) {
        return { allowed: false, reason: 'You have already bid on this case' };
      }

      // Get tier limits to calculate required points
      const tierQuery = await client.query(
        'SELECT limits FROM subscription_tiers WHERE id = $1',
        [caseData.subscription_tier_id]
      );
      
      if (tierQuery.rows.length === 0) {
        return { allowed: false, reason: 'Invalid subscription tier' };
      }

      const tierLimits = tierQuery.rows[0].limits;
      const requiredPoints = this.pointsService.calculatePointsCost(caseData.budget, tierLimits);

      // Check if provider has enough points
      const pointsBalance = await this.pointsService.getPointsBalance(providerId);
      
      if (pointsBalance.current_balance < requiredPoints) {
        return { 
          allowed: false, 
          reason: `Insufficient points. Required: ${requiredPoints}, Available: ${pointsBalance.current_balance}`,
          required_points: requiredPoints
        };
      }

      // Check if case budget is within tier limit
      const accessCheck = await this.pointsService.checkCaseAccess({
        user_id: providerId,
        case_id: caseId,
        case_budget: caseData.budget
      });
      
      if (!accessCheck.allowed) {
        return { 
          allowed: false, 
          reason: accessCheck.message || 'Cannot access case',
          required_points: requiredPoints
        };
      }

      return { allowed: true, required_points: requiredPoints };

    } finally {
      client.release();
    }
  }

  /**
   * Place a bid on a case
   * New flow: SP pays 5 points to participate, proposes budget range
   */
  async placeBid(
    caseId: string, 
    providerId: string, 
    proposedBudgetRange: string,
    bidComment?: string
  ): Promise<BidPlacementResult> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if provider already bid (within transaction)
      const existingBid = await client.query(
        'SELECT id FROM sp_case_bids WHERE case_id = $1 AND provider_id = $2',
        [caseId, providerId]
      );

      if (existingBid.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'You have already bid on this case'
        };
      }

      // Get case details and user's tier limits
      const caseQuery = await client.query(
        `SELECT c.*, st.limits, u.points_balance
         FROM marketplace_service_cases c,
              users u
         LEFT JOIN subscription_tiers st ON u.subscription_tier_id = st.id
         WHERE c.id = $1 AND u.id = $2`,
        [caseId, providerId]
      );

      if (caseQuery.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Case not found'
        };
      }

      const caseData = caseQuery.rows[0];
      
      // Check if bidding is still open
      if (caseData.current_bidders >= (caseData.max_bidders || 3)) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Maximum bidders reached'
        };
      }

      // New bidding flow: charge 5 points to participate
      const participationFee = 5;
      
      // Check if provider has at least 5 points to participate
      if (caseData.points_balance < participationFee) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Insufficient points. Required: ${participationFee}, Available: ${caseData.points_balance}`
        };
      }

      // Calculate full points cost based on proposed budget range
      // This will be charged only if SP wins
      const tierLimits = caseData.limits;
      const proposedRangeMidpoint = this.getBudgetRangeMidpoint(proposedBudgetRange);
      const fullPointsCost = this.pointsService.calculatePointsCost(proposedRangeMidpoint, tierLimits);

      // Get current bidder count to determine bid order
      const caseResult = await client.query(
        'SELECT current_bidders FROM marketplace_service_cases WHERE id = $1 FOR UPDATE',
        [caseId]
      );

      const bidOrder = caseResult.rows[0].current_bidders + 1;

      // Create the bid with proposed budget range
      const bidResult = await client.query(`
        INSERT INTO sp_case_bids (
          case_id,
          provider_id,
          points_bid,
          bid_status,
          bid_order,
          points_deducted,
          proposed_budget_range,
          bid_comment,
          participation_points
        ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)
        RETURNING id
      `, [caseId, providerId, fullPointsCost, bidOrder, participationFee, proposedBudgetRange, bidComment, participationFee]);

      const bidId = bidResult.rows[0].id;

      // Deduct only participation fee (5 points)
      const balanceResult = await client.query(`
        UPDATE users 
        SET points_balance = points_balance - $1,
            points_total_spent = points_total_spent + $1
        WHERE id = $2
        RETURNING points_balance
      `, [participationFee, providerId]);

      const newBalance = balanceResult.rows[0].points_balance;

      // Record points transaction for participation fee
      await client.query(`
        INSERT INTO sp_points_transactions (
          id, user_id, transaction_type, points_amount, balance_after, reason, case_id
        ) VALUES ($1, $2, 'spent', $3, $4, $5, $6)
      `, [
        uuidv4(),
        providerId,
        participationFee,
        newBalance,
        `Participation fee for bidding (${participationFee} points)`,
        caseId
      ]);

      // Update case bidder count
      await client.query(`
        UPDATE marketplace_service_cases
        SET current_bidders = current_bidders + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [caseId]);

      await client.query('COMMIT');

      return {
        success: true,
        bid_id: bidId,
        bid_order: bidOrder,
        points_spent: participationFee,
        message: `Bid placed successfully. You are bidder #${bidOrder}. Participation fee: ${participationFee} points. If you win, you'll pay ${fullPointsCost} points total.`
      };

    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error placing bid:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all bids for a case
   */
  async getCaseBids(caseId: string, includeProviderInfo: boolean = false): Promise<BidWithProvider[]> {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT 
          b.*
          ${includeProviderInfo ? `, 
          CONCAT(u.first_name, ' ', u.last_name) as provider_name,
          u.email as provider_email,
          u.phone_number as provider_phone,
          0 as provider_rating,
          COUNT(DISTINCT c.id) as provider_completed_cases
          ` : ''}
        FROM sp_case_bids b
        ${includeProviderInfo ? `
        LEFT JOIN users u ON u.id = b.provider_id
        LEFT JOIN marketplace_service_cases c ON c.provider_id = b.provider_id AND c.status = 'completed'
        ` : ''}
        WHERE b.case_id = $1
        ${includeProviderInfo ? 'GROUP BY b.id, u.id, u.first_name, u.last_name, u.email, u.phone_number' : ''}
        ORDER BY b.bid_order ASC
      `;

      const result = await client.query(query, [caseId]);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Customer selects winning bid
   */
  async selectWinningBid(caseId: string, winningBidId: string, customerId: string): Promise<BidSelectionResult> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify customer owns the case
      const caseResult = await client.query(
        'SELECT customer_id, bidding_closed FROM marketplace_service_cases WHERE id = $1 FOR UPDATE',
        [caseId]
      );

      if (caseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Case not found' };
      }

      if (caseResult.rows[0].customer_id !== customerId) {
        await client.query('ROLLBACK');
        return { success: false, message: 'You are not the owner of this case' };
      }

      if (caseResult.rows[0].bidding_closed) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Bidding already closed for this case' };
      }

      // Get all bids for this case
      const bidsResult = await client.query(
        'SELECT * FROM sp_case_bids WHERE case_id = $1',
        [caseId]
      );

      const bids = bidsResult.rows;
      const winningBid = bids.find(b => b.id === winningBidId);

      if (!winningBid) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Winning bid not found' };
      }

      // New flow: Winner pays full amount (points_bid), losers keep only 5 points deducted
      
      // Charge winner the remaining points (they already paid 5 for participation)
      const remainingPoints = winningBid.points_bid - (winningBid.participation_points || 5);
      
      if (remainingPoints > 0) {
        // Deduct remaining points from winner
        const balanceResult = await client.query(`
          UPDATE users
          SET points_balance = points_balance - $1,
              points_total_spent = points_total_spent + $1
          WHERE id = $2
          RETURNING points_balance
        `, [remainingPoints, winningBid.provider_id]);

        const newBalance = balanceResult.rows[0].points_balance;

        // Record transaction for remaining points
        await client.query(`
          INSERT INTO sp_points_transactions (
            id,
            user_id,
            points_amount,
            balance_after,
            transaction_type,
            reason,
            case_id
          ) VALUES ($1, $2, $3, $4, 'spent', $5, $6)
        `, [
          uuidv4(),
          winningBid.provider_id,
          remainingPoints,
          newBalance,
          `Winning bid - remaining points (${remainingPoints} points)`,
          caseId
        ]);
      }

      // Update winning bid status
      await client.query(`
        UPDATE sp_case_bids
        SET bid_status = 'won',
            points_deducted = points_bid,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [winningBidId]);

      // Process losing bids - they keep only 5 points deducted (participation fee)
      for (const bid of bids) {
        if (bid.id !== winningBidId) {
          // Losers keep only participation fee (5 points), no additional charges
          // Update bid status to lost
          await client.query(`
            UPDATE sp_case_bids
            SET bid_status = 'lost',
                points_deducted = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [bid.participation_points || 5, bid.id]);
        }
      }

      // Assign case to winner and close bidding
      await client.query(`
        UPDATE marketplace_service_cases
        SET provider_id = $1,
            status = 'accepted',
            bidding_closed = TRUE,
            bidding_closed_at = CURRENT_TIMESTAMP,
            winning_bid_id = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [winningBid.provider_id, winningBidId, caseId]);

      await client.query('COMMIT');

      return {
        success: true,
        winning_bid_id: winningBidId,
        winner_provider_id: winningBid.provider_id,
        message: 'Winner selected successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error selecting winning bid:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get provider's active bids
   */
  async getProviderBids(providerId: string, status?: string): Promise<BidWithProvider[]> {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT 
          b.*,
          c.service_type,
          c.description,
          c.budget,
          c.city,
          c.status as case_status,
          c.bidding_closed
        FROM sp_case_bids b
        JOIN marketplace_service_cases c ON c.id = b.case_id
        WHERE b.provider_id = $1
      `;

      const params: any[] = [providerId];

      if (status) {
        query += ' AND b.bid_status = $2';
        params.push(status);
      }

      query += ' ORDER BY b.created_at DESC';

      const result = await client.query(query, params);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Cancel a bid (only if bidding not closed)
   */
  async cancelBid(bidId: string, providerId: string): Promise<{ success: boolean; message: string }> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get bid details
      const bidResult = await client.query(`
        SELECT b.*, c.bidding_closed
        FROM sp_case_bids b
        JOIN marketplace_service_cases c ON c.id = b.case_id
        WHERE b.id = $1 AND b.provider_id = $2
        FOR UPDATE
      `, [bidId, providerId]);

      if (bidResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Bid not found' };
      }

      const bid = bidResult.rows[0];

      if (bid.bidding_closed) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Cannot cancel bid - bidding is closed' };
      }

      if (bid.bid_status !== 'pending') {
        await client.query('ROLLBACK');
        return { success: false, message: 'Bid already processed' };
      }

      // Refund full points
      await client.query(`
        UPDATE users
        SET points_balance = points_balance + $1,
            points_total_spent = points_total_spent - $2
        WHERE id = $3
      `, [bid.points_bid, bid.points_bid, providerId]);

      // Record refund
      await client.query(`
        INSERT INTO sp_points_transactions (
          user_id,
          amount,
          transaction_type,
          description,
          case_id
        ) VALUES ($1, $2, 'refund', 'Bid cancelled - full refund', $3)
      `, [providerId, bid.points_bid, bid.case_id]);

      // Update bid status
      await client.query(`
        UPDATE sp_case_bids
        SET bid_status = 'refunded',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [bidId]);

      // Decrease case bidder count
      await client.query(`
        UPDATE marketplace_service_cases
        SET current_bidders = current_bidders - 1
        WHERE id = $1
      `, [bid.case_id]);

      await client.query('COMMIT');

      return { success: true, message: 'Bid cancelled and points refunded' };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error cancelling bid:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get midpoint of budget range for points calculation
   */
  private getBudgetRangeMidpoint(rangeValue: string): number {
    const ranges: { [key: string]: number } = {
      '1-250': 125,
      '250-500': 375,
      '500-750': 625,
      '750-1000': 875,
      '1000-1250': 1125,
      '1250-1500': 1375,
      '1500-1750': 1625,
      '1750-2000': 1875,
      '2000+': 2500  // Estimate for 2000+
    };
    
    return ranges[rangeValue] || 500; // Default to 500 if unknown
  }
}
