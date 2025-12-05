/**
 * Direct Assignment Controller
 * Handles the negotiation flow when a customer sends a case directly to a specific SP
 * 
 * Flow:
 * 1. Customer sends case to SP with budget → status: 'pending_sp_review'
 * 2. SP can: Accept, Decline, or Counter-offer
 * 3. If counter-offer: Customer can Accept, Decline, or Send to Marketplace
 * 4. Points deducted only when deal is finalized
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';
import { PointsService } from '../services/PointsService';
import { NotificationService } from '../services/NotificationService';
import logger from '../utils/logger';

let pool: Pool;
let pointsService: PointsService;
let notificationService: NotificationService;

export function initializeDirectAssignmentController(dbPool: Pool) {
  pool = dbPool;
  pointsService = new PointsService();
  notificationService = new NotificationService();
  
  const router = Router();

  /**
   * POST /api/v1/direct-assignment/:caseId/sp-respond
   * SP responds to a direct assignment request
   * Body: { action: 'accept' | 'decline' | 'counter', counterBudget?: string, message?: string }
   */
  router.post('/:caseId/sp-respond', authenticateToken, async (req: Request, res: Response) => {
    const client = await pool.connect();
    
    try {
      const { caseId } = req.params;
      const { action, counterBudget, message } = req.body;
      const providerId = (req as any).user?.id;

      if (!providerId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
        });
      }

      if (!['accept', 'decline', 'counter'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ACTION', message: 'Action must be: accept, decline, or counter' }
        });
      }

      await client.query('BEGIN');

      // Get case details with lock (separate from user data to avoid FOR UPDATE with LEFT JOIN)
      const caseResult = await client.query(`
        SELECT * FROM marketplace_service_cases WHERE id = $1 FOR UPDATE
      `, [caseId]);

      if (caseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Case not found' }
        });
      }

      const caseData = caseResult.rows[0];

      // Get user tier info separately (no lock needed)
      const userTierResult = await client.query(`
        SELECT u.subscription_tier_id, st.limits
        FROM users u
        LEFT JOIN subscription_tiers st ON st.id = u.subscription_tier_id
        WHERE u.id = $1
      `, [providerId]);
      
      if (userTierResult.rows.length > 0) {
        caseData.subscription_tier_id = userTierResult.rows[0].subscription_tier_id;
        caseData.limits = userTierResult.rows[0].limits;
      }

      // Verify this SP is assigned to review this case
      if (caseData.assigned_sp_id !== providerId && caseData.provider_id !== providerId) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not assigned to this case' }
        });
      }

      // Verify case is in reviewable state
      if (caseData.negotiation_status !== 'pending_sp_review' && caseData.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Case is not pending your review' }
        });
      }

      const tierLimits = caseData.limits;
      let result: any = {};

      if (action === 'accept') {
        // SP accepts at customer's budget - deduct points and assign case
        const budgetToUse = caseData.customer_budget || caseData.budget;
        const budgetMidpoint = getBudgetRangeMidpoint(budgetToUse);
        const pointsCost = pointsService.calculatePointsCost(budgetMidpoint, tierLimits);

        // Check if SP has enough points
        const pointsBalance = await pointsService.getPointsBalance(providerId);
        if (pointsBalance.current_balance < pointsCost) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: { 
              code: 'INSUFFICIENT_POINTS', 
              message: `Insufficient points. Required: ${pointsCost}, Available: ${pointsBalance.current_balance}` 
            }
          });
        }

        // Deduct points
        await client.query(`
          UPDATE users 
          SET points_balance = points_balance - $1,
              points_total_spent = points_total_spent + $1
          WHERE id = $2
        `, [pointsCost, providerId]);

        // Record transaction
        await client.query(`
          INSERT INTO sp_points_transactions (id, user_id, points_amount, balance_after, transaction_type, reason, case_id)
          VALUES ($1, $2, $3, $4, 'spent', $5, $6)
        `, [
          uuidv4(),
          providerId,
          pointsCost,
          pointsBalance.current_balance - pointsCost,
          `Direct assignment accepted - Budget: ${budgetToUse}`,
          caseId
        ]);

        // Update case to accepted
        await client.query(`
          UPDATE marketplace_service_cases
          SET status = 'accepted',
              provider_id = $1,
              negotiation_status = 'accepted',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [providerId, caseId]);

        result = {
          action: 'accepted',
          pointsSpent: pointsCost,
          budget: budgetToUse,
          message: `Case accepted. ${pointsCost} points deducted.`
        };

        // Notify customer
        try {
          await notificationService.createNotification(
            caseData.customer_id,
            'case_accepted',
            'Заявката е приета! ✅',
            `${caseData.provider_name || 'Специалистът'} прие вашата заявка.`,
            { caseId, providerId }
          );
        } catch (e) {
          logger.error('Failed to send acceptance notification', e);
        }

      } else if (action === 'decline') {
        // SP declines - case goes to marketplace for bidding
        await client.query(`
          UPDATE marketplace_service_cases
          SET negotiation_status = 'sp_declined',
              status = 'pending',
              assigned_sp_id = NULL,
              assignment_type = 'open',
              bidding_enabled = true,
              max_bidders = 3,
              decline_reason = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [message || 'Declined by service provider', caseId]);

        result = {
          action: 'declined',
          message: 'Case declined'
        };

        // Notify customer they can send to marketplace or cancel
        try {
          await notificationService.createNotification(
            caseData.customer_id,
            'case_declined',
            'Заявката е отказана',
            `${caseData.provider_name || 'Специалистът'} отказа заявката. Можете да я изпратите към други специалисти.`,
            { caseId, providerId, canSendToMarketplace: true }
          );
        } catch (e) {
          logger.error('Failed to send decline notification', e);
        }

      } else if (action === 'counter') {
        // SP makes counter-offer
        if (!counterBudget) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: { code: 'MISSING_COUNTER_BUDGET', message: 'Counter budget is required' }
          });
        }

        // Validate counter budget is within SP's tier limits
        const counterMidpoint = getBudgetRangeMidpoint(counterBudget);
        const maxBudget = tierLimits?.max_case_budget || 10000;
        if (counterMidpoint > maxBudget) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: { 
              code: 'BUDGET_EXCEEDS_TIER', 
              message: `Counter budget exceeds your tier limit (${maxBudget} BGN)` 
            }
          });
        }

        await client.query(`
          UPDATE marketplace_service_cases
          SET negotiation_status = 'counter_offered',
              sp_counter_budget = $1,
              counter_message = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [counterBudget, message || null, caseId]);

        result = {
          action: 'counter_offered',
          counterBudget,
          message: message || null
        };

        // Notify customer about counter-offer
        try {
          await notificationService.createNotification(
            caseData.customer_id,
            'counter_offer',
            'Нова оферта от специалист! 💰',
            `${caseData.provider_name || 'Специалистът'} предложи бюджет ${counterBudget} BGN.${message ? ` Съобщение: ${message}` : ''}`,
            { caseId, providerId, counterBudget, message }
          );
        } catch (e) {
          logger.error('Failed to send counter-offer notification', e);
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error in SP respond:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: error.message }
      });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/v1/direct-assignment/:caseId/customer-respond
   * Customer responds to SP's counter-offer
   * Body: { action: 'accept' | 'decline' }
   */
  router.post('/:caseId/customer-respond', authenticateToken, async (req: Request, res: Response) => {
    const client = await pool.connect();
    
    try {
      const { caseId } = req.params;
      const { action } = req.body;
      const customerId = (req as any).user?.id;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
        });
      }

      if (!['accept', 'decline'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ACTION', message: 'Action must be: accept or decline' }
        });
      }

      await client.query('BEGIN');

      // Get case details with lock (separate from user data to avoid FOR UPDATE with LEFT JOIN)
      const caseResult = await client.query(`
        SELECT * FROM marketplace_service_cases WHERE id = $1 FOR UPDATE
      `, [caseId]);

      if (caseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Case not found' }
        });
      }

      const caseData = caseResult.rows[0];

      // Get SP tier info separately (no lock needed)
      if (caseData.assigned_sp_id) {
        const spTierResult = await client.query(`
          SELECT u.subscription_tier_id, st.limits
          FROM users u
          LEFT JOIN subscription_tiers st ON st.id = u.subscription_tier_id
          WHERE u.id = $1
        `, [caseData.assigned_sp_id]);
        
        if (spTierResult.rows.length > 0) {
          caseData.subscription_tier_id = spTierResult.rows[0].subscription_tier_id;
          caseData.limits = spTierResult.rows[0].limits;
        }
      }

      // Verify customer owns this case
      if (caseData.customer_id !== customerId) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not the owner of this case' }
        });
      }

      // Verify case has a counter-offer
      if (caseData.negotiation_status !== 'counter_offered') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATE', message: 'No counter-offer to respond to' }
        });
      }

      const providerId = caseData.assigned_sp_id || caseData.provider_id;
      const tierLimits = caseData.limits;
      let result: any = {};

      if (action === 'accept') {
        // Customer accepts counter-offer - deduct points from SP and assign
        const budgetToUse = caseData.sp_counter_budget;
        const budgetMidpoint = getBudgetRangeMidpoint(budgetToUse);
        const pointsCost = pointsService.calculatePointsCost(budgetMidpoint, tierLimits);

        // Check if SP has enough points
        const pointsBalance = await pointsService.getPointsBalance(providerId);
        if (pointsBalance.current_balance < pointsCost) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: { 
              code: 'SP_INSUFFICIENT_POINTS', 
              message: 'The service provider does not have enough points to accept this case.' 
            }
          });
        }

        // Deduct points from SP
        await client.query(`
          UPDATE users 
          SET points_balance = points_balance - $1,
              points_total_spent = points_total_spent + $1
          WHERE id = $2
        `, [pointsCost, providerId]);

        // Record transaction
        await client.query(`
          INSERT INTO sp_points_transactions (id, user_id, points_amount, balance_after, transaction_type, reason, case_id)
          VALUES ($1, $2, $3, $4, 'spent', $5, $6)
        `, [
          uuidv4(),
          providerId,
          pointsCost,
          pointsBalance.current_balance - pointsCost,
          `Customer accepted counter-offer - Budget: ${budgetToUse}`,
          caseId
        ]);

        // Update case to accepted
        await client.query(`
          UPDATE marketplace_service_cases
          SET status = 'accepted',
              provider_id = $1,
              budget = $2,
              negotiation_status = 'accepted',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [providerId, budgetToUse, caseId]);

        result = {
          action: 'accepted',
          finalBudget: budgetToUse,
          message: 'Counter-offer accepted. Case assigned to service provider.'
        };

        // Notify SP
        try {
          await notificationService.createNotification(
            providerId,
            'counter_accepted',
            'Офертата е приета! ✅',
            `Клиентът прие вашата оферта от ${budgetToUse} BGN. ${pointsCost} точки бяха удържани.`,
            { caseId, customerId, pointsSpent: pointsCost }
          );
        } catch (e) {
          logger.error('Failed to send counter-acceptance notification', e);
        }

      } else if (action === 'decline') {
        // Customer declines counter-offer
        await client.query(`
          UPDATE marketplace_service_cases
          SET negotiation_status = 'customer_declined',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [caseId]);

        result = {
          action: 'declined',
          message: 'Counter-offer declined. You can cancel the case or send it to the marketplace.',
          options: ['cancel', 'send_to_marketplace']
        };

        // Notify SP
        try {
          await notificationService.createNotification(
            providerId,
            'counter_declined',
            'Офертата е отказана',
            'Клиентът отказа вашата оферта.',
            { caseId, customerId }
          );
        } catch (e) {
          logger.error('Failed to send counter-decline notification', e);
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error in customer respond:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: error.message }
      });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/v1/direct-assignment/:caseId/send-to-marketplace
   * Customer sends a declined case to the open marketplace
   */
  router.post('/:caseId/send-to-marketplace', authenticateToken, async (req: Request, res: Response) => {
    const client = await pool.connect();
    
    try {
      const { caseId } = req.params;
      const customerId = (req as any).user?.id;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
        });
      }

      await client.query('BEGIN');

      // Get case and verify ownership
      const caseResult = await client.query(`
        SELECT * FROM marketplace_service_cases WHERE id = $1 FOR UPDATE
      `, [caseId]);

      if (caseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Case not found' }
        });
      }

      const caseData = caseResult.rows[0];

      if (caseData.customer_id !== customerId) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not the owner of this case' }
        });
      }

      // Only allow sending to marketplace if SP declined or customer declined counter
      const allowedStatuses = ['sp_declined', 'customer_declined'];
      if (!allowedStatuses.includes(caseData.negotiation_status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Case cannot be sent to marketplace in current state' }
        });
      }

      // Reset case for marketplace
      await client.query(`
        UPDATE marketplace_service_cases
        SET status = 'pending',
            negotiation_status = 'none',
            assignment_type = 'open',
            is_open_case = true,
            assigned_sp_id = NULL,
            provider_id = NULL,
            provider_name = NULL,
            sp_counter_budget = NULL,
            counter_message = NULL,
            bidding_enabled = true,
            max_bidders = 3,
            current_bidders = 0,
            bidding_closed = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [caseId]);

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          message: 'Case sent to marketplace. Up to 3 service providers can now bid on it.',
          caseId
        }
      });

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error sending to marketplace:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: error.message }
      });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/v1/direct-assignment/:caseId/cancel
   * Customer cancels/deletes a case
   */
  router.post('/:caseId/cancel', authenticateToken, async (req: Request, res: Response) => {
    const client = await pool.connect();
    
    try {
      const { caseId } = req.params;
      const customerId = (req as any).user?.id;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
        });
      }

      await client.query('BEGIN');

      // Get case and verify ownership
      const caseResult = await client.query(`
        SELECT * FROM marketplace_service_cases WHERE id = $1 FOR UPDATE
      `, [caseId]);

      if (caseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Case not found' }
        });
      }

      const caseData = caseResult.rows[0];

      if (caseData.customer_id !== customerId) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not the owner of this case' }
        });
      }

      // Cannot cancel accepted or completed cases
      if (['accepted', 'completed', 'in_progress'].includes(caseData.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Cannot cancel a case that is already accepted or completed' }
        });
      }

      // Mark as cancelled
      await client.query(`
        UPDATE marketplace_service_cases
        SET status = 'cancelled',
            negotiation_status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [caseId]);

      await client.query('COMMIT');

      // Notify SP if there was one assigned
      if (caseData.assigned_sp_id || caseData.provider_id) {
        try {
          await notificationService.createNotification(
            caseData.assigned_sp_id || caseData.provider_id,
            'case_cancelled',
            'Заявката е отменена',
            'Клиентът отмени заявката.',
            { caseId }
          );
        } catch (e) {
          logger.error('Failed to send cancellation notification', e);
        }
      }

      res.json({
        success: true,
        data: {
          message: 'Case cancelled successfully',
          caseId
        }
      });

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error cancelling case:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: error.message }
      });
    } finally {
      client.release();
    }
  });

  return router;
}

/**
 * Get midpoint of budget range for points calculation
 * Same logic as BiddingService
 */
function getBudgetRangeMidpoint(rangeValue: string): number {
  const ranges: { [key: string]: number } = {
    '1-250': 125,
    '250-500': 375,
    '500-750': 625,
    '750-1000': 875,
    '1000-1250': 1125,
    '1250-1500': 1375,
    '1500-1750': 1625,
    '1750-2000': 1875,
    '2000+': 2500,
    '2000-3000': 2500,
    '3000-4000': 3500,
    '4000-5000': 4500,
    '5000-7500': 6250,
    '7500-10000': 8750
  };
  
  return ranges[rangeValue] || 500;
}
