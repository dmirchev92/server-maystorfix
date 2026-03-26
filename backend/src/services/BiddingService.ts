import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { PointsService } from './PointsService';
import { NotificationService } from './NotificationService';

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
  private notificationService: NotificationService;

  // Loser fee configuration based on budget range (in points)
  // 5 лв = 26 pts, 8 лв = 41 pts, 12 лв = 61 pts, 15 лв = 77 pts
  private readonly LOSER_FEES = {
    LOW: 26,      // 1-250 to 251-500: 5 лв
    MEDIUM: 41,   // 501-750 to 751-1000: 8 лв
    HIGH: 61,     // 1001-2000 to 3001-4000: 12 лв
    PREMIUM: 77   // 4001+: 15 лв
  };

  /**
   * Calculate loser fee based on case budget range
   */
  private calculateLoserFee(budget: string | null): number {
    if (!budget) return this.LOSER_FEES.LOW;
    
    // Extract the upper bound from budget string (e.g., "251-500" -> 500, "5000+" -> 5000)
    const cleanBudget = budget.replace(/[^\d\-+]/g, '');
    let upperBound = 0;
    
    if (cleanBudget.includes('-')) {
      const parts = cleanBudget.split('-');
      upperBound = parseInt(parts[1]) || parseInt(parts[0]) || 0;
    } else if (cleanBudget.includes('+')) {
      upperBound = parseInt(cleanBudget.replace('+', '')) || 0;
      upperBound = upperBound > 0 ? 999999 : 0; // Treat "5000+" as very high
    } else {
      upperBound = parseInt(cleanBudget) || 0;
    }
    
    // Determine fee based on budget range
    if (upperBound <= 500) {
      return this.LOSER_FEES.LOW;      // 1-250, 251-500: 5 лв = 26 pts
    } else if (upperBound <= 1000) {
      return this.LOSER_FEES.MEDIUM;   // 501-750, 751-1000: 8 лв = 41 pts
    } else if (upperBound <= 4000) {
      return this.LOSER_FEES.HIGH;     // 1001-2000, 2001-3000, 3001-4000: 12 лв = 61 pts
    } else {
      return this.LOSER_FEES.PREMIUM;  // 4001+: 15 лв = 77 pts
    }
  }

  constructor(pool: Pool) {
    this.pool = pool;
    this.pointsService = new PointsService();
    this.notificationService = new NotificationService();
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
      // Convert budget range string to numeric midpoint for points calculation
      const budgetMidpoint = this.getBudgetRangeMidpoint(caseData.budget);
      const requiredPoints = this.pointsService.calculatePointsCost(budgetMidpoint, tierLimits);

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
        case_budget: budgetMidpoint
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
   * Flow: No upfront cost, only winner pays full tier-based cost
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

      // No participation fee - winner pays full tier-based cost only
      // const participationFee = 3;
      const participationFee = 0;
      
      // Calculate full tier-based points cost based on SP's PROPOSED budget (not case budget)
      // This is fair: SP pays for what they proposed, not what customer originally requested
      const tierLimits = caseData.limits;
      const proposedBudgetMidpoint = this.getBudgetRangeMidpoint(proposedBudgetRange);
      const fullPointsCost = this.pointsService.calculatePointsCost(proposedBudgetMidpoint, tierLimits);
      
      // Validate that the proposed budget is within tier limits
      const maxBudget = tierLimits.max_case_budget;
      if (proposedBudgetMidpoint > maxBudget) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Your proposed budget (${proposedBudgetRange}) exceeds your tier limit (${maxBudget} BGN). Please upgrade or propose a lower budget.`
        };
      }
      
      // Check if tier supports this budget range (point cost should not be 0)
      // SKIP during LAUNCH_MODE - all budget ranges are free (points_cost_* = 0)
      const LAUNCH_MODE = process.env.LAUNCH_MODE === 'true';
      if (fullPointsCost === 0 && !LAUNCH_MODE) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Your tier does not support the proposed budget range (${proposedBudgetRange}). Please upgrade or propose a different budget.`
        };
      }
      
      // No upfront points check needed - winner pays later
      // if (caseData.points_balance < participationFee) {
      //   await client.query('ROLLBACK');
      //   return {
      //     success: false,
      //     message: `Insufficient points. Required: ${participationFee}, Available: ${caseData.points_balance}`
      //   };
      // }

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

      // No upfront payment - winner pays later
      // const balanceResult = await client.query(`
      //   UPDATE users 
      //   SET points_balance = points_balance - $1,
      //       points_total_spent = points_total_spent + $1
      //   WHERE id = $2
      //   RETURNING points_balance
      // `, [participationFee, providerId]);

      // const newBalance = balanceResult.rows[0].points_balance;

      // Record points transaction for participation fee
      // await client.query(`
      //   INSERT INTO sp_points_transactions (
      //     id, user_id, transaction_type, points_amount, balance_after, reason, case_id
      //   ) VALUES ($1, $2, 'spent', $3, $4, $5, $6)
      // `, [
      //   uuidv4(),
      //   providerId,
      //   participationFee,
      //   newBalance,
      //   `Participation fee for bidding (${participationFee} points)`,
      //   caseId
      // ]);

      // Update case bidder count
      await client.query(`
        UPDATE marketplace_service_cases
        SET current_bidders = current_bidders + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [caseId]);

      await client.query('COMMIT');

      // Send notification to customer about new bid
      try {
        const customerQuery = await client.query(
          'SELECT customer_id FROM marketplace_service_cases WHERE id = $1',
          [caseId]
        );
        const customerId = customerQuery.rows[0]?.customer_id;
        
        if (customerId) {
          const providerQuery = await client.query(
            'SELECT first_name, last_name FROM users WHERE id = $1',
            [providerId]
          );
          const providerName = providerQuery.rows[0] ? 
            `${providerQuery.rows[0].first_name} ${providerQuery.rows[0].last_name}`.trim() : 
            'Service Provider';
          
          await this.notificationService.notifyNewBidPlaced(
            caseId,
            customerId,
            providerName,
            proposedBudgetRange // Send the proposed price, not points
          );
        }
      } catch (notificationError) {
        console.error('Error sending new bid notification:', notificationError);
        // Non-critical error, don't fail the bid
      }

      // Send confirmation notification to provider
      try {
        await this.notificationService.notifyBidPlacedConfirmation(
          caseId,
          providerId,
          proposedBudgetRange,
          bidOrder
        );
      } catch (notificationError) {
        console.error('Error sending bid confirmation notification:', notificationError);
      }

      return {
        success: true,
        bid_id: bidId,
        bid_order: bidOrder,
        points_spent: 0,
        message: `Bid placed successfully. You are bidder #${bidOrder}. No upfront cost. If you win, you'll pay ${fullPointsCost} points (tier-based).`
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
          u.first_name as provider_first_name,
          u.last_name as provider_last_name,
          u.email as provider_email,
          u.phone_number as provider_phone,
          spp.rating as provider_rating,
          spp.business_name as provider_company,
          spp.service_category as provider_service_category,
          spp.city as provider_city,
          spp.neighborhood as provider_neighborhood,
          spp.description as provider_description,
          spp.experience_years as provider_experience_years,
          spp.profile_image_url as provider_profile_image_url,
          COUNT(DISTINCT c.id) as provider_completed_cases
          ` : ''}
        FROM sp_case_bids b
        ${includeProviderInfo ? `
        LEFT JOIN users u ON u.id = b.provider_id
        LEFT JOIN service_provider_profiles spp ON spp.user_id = b.provider_id
        LEFT JOIN marketplace_service_cases c ON c.provider_id = b.provider_id AND c.status = 'completed'
        ` : ''}
        WHERE b.case_id = $1
        ${includeProviderInfo ? 'GROUP BY b.id, u.id, u.first_name, u.last_name, u.email, u.phone_number, spp.rating, spp.business_name, spp.service_category, spp.city, spp.neighborhood, spp.description, spp.experience_years, spp.profile_image_url' : ''}
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

      // Verify customer owns the case and get budget for loser fee calculation
      const caseResult = await client.query(
        'SELECT customer_id, bidding_closed, budget FROM marketplace_service_cases WHERE id = $1 FOR UPDATE',
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

      // Winner pays full tier-based cost (no participation fee was charged)
      const remainingPoints = winningBid.points_bid - (winningBid.participation_points || 0);
      
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
          `Winning bid - full tier-based cost (${remainingPoints} points)`,
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

      // Process losing bids - charge fixed fee based on case budget range
      const caseBudget = caseResult.rows[0].budget;
      const loserFee = this.calculateLoserFee(caseBudget);
      
      for (const bid of bids) {
        if (bid.id !== winningBidId) {
          // Charge loser the participation fee based on budget range
          if (loserFee > 0) {
            const loserBalanceResult = await client.query(`
              UPDATE users
              SET points_balance = points_balance - $1,
                  points_total_spent = points_total_spent + $1
              WHERE id = $2
              RETURNING points_balance
            `, [loserFee, bid.provider_id]);

            const loserNewBalance = loserBalanceResult.rows[0]?.points_balance || 0;

            // Record transaction for loser's participation fee
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
              bid.provider_id,
              loserFee,
              loserNewBalance,
              `Такса участие - офертата не е избрана (${loserFee} точки)`,
              caseId
            ]);
          }

          // Update bid status to lost
          await client.query(`
            UPDATE sp_case_bids
            SET bid_status = 'lost',
                points_deducted = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [loserFee, bid.id]);
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

      // Send notifications to all providers
      try {
        // Get case details for notifications
        const caseDetails = await client.query(
          'SELECT description, service_type FROM marketplace_service_cases WHERE id = $1',
          [caseId]
        );
        const caseDescription = caseDetails.rows[0]?.description || caseDetails.rows[0]?.service_type || 'услугата';

        // Get customer name
        const customerQuery = await client.query(
          'SELECT first_name, last_name FROM users WHERE id = $1',
          [customerId]
        );
        const customerName = customerQuery.rows[0] ? 
          `${customerQuery.rows[0].first_name} ${customerQuery.rows[0].last_name}`.trim() : 
          'Клиента';

        // Send win notification to winner
        await this.notificationService.notifyBidWon(
          caseId,
          winningBid.provider_id,
          customerName,
          caseDescription
        );

        // Send lose notifications to all other bidders
        for (const bid of bids) {
          if (bid.id !== winningBidId) {
            await this.notificationService.notifyBidLost(
              caseId,
              bid.provider_id,
              customerName,
              caseDescription
            );
          }
        }

        // Get winner's name for customer notification
        const winnerQuery = await client.query(
          `SELECT COALESCE(sp.business_name, u.first_name || ' ' || u.last_name) as provider_name
           FROM users u
           LEFT JOIN service_provider_profiles sp ON sp.user_id = u.id
           WHERE u.id = $1`,
          [winningBid.provider_id]
        );
        const winnerName = winnerQuery.rows[0]?.provider_name || 'Специалист';

        // Notify customer that they selected a winner
        await this.notificationService.notifyWinnerSelected(
          caseId,
          customerId,
          winnerName
        );
      } catch (notificationError) {
        console.error('Error sending bid result notifications:', notificationError);
        // Non-critical error
      }

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
          c.bidding_closed,
          c.case_number
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
   * Budget ranges are in EUR, max 10000€
   */
  private getBudgetRangeMidpoint(rangeValue: string): number {
    const ranges: { [key: string]: number } = {
      '1-250': 125,
      '251-500': 375,
      '501-750': 625,
      '751-1000': 875,
      '1001-2000': 1500,
      '2001-3000': 2500,
      '3001-4000': 3500,
      '4001-5000': 4500,
      '5001-6000': 5500,
      '6001-7000': 6500,
      '7001-8000': 7500,
      '8001-9000': 8500,
      '9001-10000': 9500,
      '10000+': 12000  // Estimate for 10000+
    };
    
    // Try exact match first
    if (ranges[rangeValue]) {
      return ranges[rangeValue];
    }
    
    // Try to parse range format "X-Y" dynamically
    if (rangeValue.includes('-')) {
      const parts = rangeValue.split('-');
      const min = parseInt(parts[0], 10);
      const max = parseInt(parts[1], 10);
      if (!isNaN(min) && !isNaN(max)) {
        return Math.round((min + max) / 2);
      }
    }
    
    // Handle "X+" format
    if (rangeValue.endsWith('+')) {
      const min = parseInt(rangeValue.replace('+', ''), 10);
      if (!isNaN(min)) {
        return min + 1000; // Estimate
      }
    }
    
    return 500; // Default fallback
  }
}
