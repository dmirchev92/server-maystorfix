/**
 * Points Controller
 * Handles API endpoints for points system and case access
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import pointsService from '../services/PointsService';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/points/balance
 * Get user's current points balance
 */
router.get(
  '/balance',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const balance = await pointsService.getPointsBalance(userId);

      res.json({
        success: true,
        data: balance,
        metadata: {
          timestamp: new Date()
        }
      });
    } catch (error: any) {
      logger.error('Failed to get points balance', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'BALANCE_ERROR',
          message: error.message || 'Failed to get points balance'
        }
      });
    }
  }
);

/**
 * POST /api/v1/points/check-access
 * Check if user can access a case
 */
router.post(
  '/check-access',
  authenticateToken,
  [
    body('case_id')
      .isString()
      .notEmpty()
      .withMessage('Case ID is required'),
    body('case_budget')
      .isNumeric()
      .withMessage('Case budget must be a number')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const { case_id, case_budget } = req.body;

      const accessResult = await pointsService.checkCaseAccess({
        user_id: userId,
        case_id,
        case_budget: parseFloat(case_budget)
      });

      res.json({
        success: true,
        data: accessResult,
        metadata: {
          timestamp: new Date()
        }
      });
    } catch (error: any) {
      logger.error('Failed to check case access', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'ACCESS_CHECK_ERROR',
          message: error.message || 'Failed to check case access'
        }
      });
    }
  }
);

/**
 * POST /api/v1/points/spend
 * Spend points to access a case
 */
router.post(
  '/spend',
  authenticateToken,
  [
    body('case_id')
      .isString()
      .notEmpty()
      .withMessage('Case ID is required'),
    body('case_budget')
      .isNumeric()
      .withMessage('Case budget must be a number')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const { case_id, case_budget } = req.body;

      const caseAccess = await pointsService.spendPointsForCase({
        user_id: userId,
        case_id,
        case_budget: parseFloat(case_budget)
      });

      // Get updated balance
      const balance = await pointsService.getPointsBalance(userId);

      logger.info('Points spent successfully', { userId, caseId: case_id });

      res.json({
        success: true,
        data: {
          case_access: caseAccess,
          balance,
          message: 'Points spent successfully'
        },
        metadata: {
          timestamp: new Date()
        }
      });
    } catch (error: any) {
      logger.error('Failed to spend points', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'SPEND_ERROR',
          message: error.message || 'Failed to spend points'
        }
      });
    }
  }
);

/**
 * GET /api/v1/points/transactions
 * Get user's points transaction history
 */
router.get(
  '/transactions',
  authenticateToken,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a positive integer')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const transactions = await pointsService.getTransactionHistory(userId, limit, offset);

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            limit,
            offset,
            count: transactions.length
          }
        },
        metadata: {
          timestamp: new Date()
        }
      });
    } catch (error: any) {
      logger.error('Failed to get transaction history', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'TRANSACTIONS_ERROR',
          message: error.message || 'Failed to get transaction history'
        }
      });
    }
  }
);

/**
 * GET /api/v1/points/accessed-cases
 * Get cases accessed by user
 */
router.get(
  '/accessed-cases',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const accessedCases = await pointsService.getAccessedCases(userId);

      res.json({
        success: true,
        data: {
          accessed_cases: accessedCases,
          count: accessedCases.length
        },
        metadata: {
          timestamp: new Date()
        }
      });
    } catch (error: any) {
      logger.error('Failed to get accessed cases', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'ACCESSED_CASES_ERROR',
          message: error.message || 'Failed to get accessed cases'
        }
      });
    }
  }
);

/**
 * POST /api/v1/points/award (Admin only)
 * Award bonus points to a user
 */
router.post(
  '/award',
  authenticateToken,
  [
    body('user_id')
      .isString()
      .notEmpty()
      .withMessage('User ID is required'),
    body('points')
      .isInt({ min: 1 })
      .withMessage('Points must be a positive integer'),
    body('reason')
      .isString()
      .notEmpty()
      .withMessage('Reason is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const adminId = (req as any).user?.id;
      const adminRole = (req as any).user?.role;
      
      if (!adminId || adminRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admin access required'
          }
        });
      }

      const { user_id, points, reason } = req.body;

      const balance = await pointsService.awardPoints(user_id, points, reason, 'bonus');

      logger.info('Bonus points awarded', { adminId, userId: user_id, points });

      res.json({
        success: true,
        data: {
          balance,
          message: 'Points awarded successfully'
        },
        metadata: {
          timestamp: new Date()
        }
      });
    } catch (error: any) {
      logger.error('Failed to award points', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'AWARD_ERROR',
          message: error.message || 'Failed to award points'
        }
      });
    }
  }
);

export default router;
