/**
 * VIP Controller
 * API endpoints for VIP visibility feature
 */

import { Router, Request, Response } from 'express';
import { VipService, VipType } from '../services/VipService';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const vipService = new VipService();

/**
 * Middleware to check if VIP feature is enabled
 */
const checkVipEnabled = (req: Request, res: Response, next: Function) => {
  if (!vipService.isVipEnabled()) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'FEATURE_DISABLED',
        message: 'VIP функцията не е активна.'
      }
    });
  }
  next();
};

/**
 * GET /api/v1/vip/config
 * Get VIP configuration (public, but can be authenticated)
 * Returns all config needed by frontend (no hardcoded values)
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    if (!vipService.isVipEnabled()) {
      return res.json({
        success: true,
        data: {
          enabled: false,
          message: 'VIP функцията не е активна.'
        }
      });
    }

    const config = await vipService.getConfig();
    
    return res.json({
      success: true,
      data: {
        enabled: true,
        ...config
      }
    });
  } catch (error) {
    logger.error('Failed to get VIP config', { error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Възникна грешка при зареждане на конфигурацията.'
      }
    });
  }
});

/**
 * GET /api/v1/vip/overview
 * Get SP's current VIP status and placements
 * Requires authentication
 */
router.get('/overview', authenticateToken, checkVipEnabled, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Неоторизиран достъп.' }
      });
    }

    const overview = await vipService.getOverview(userId);
    
    return res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    logger.error('Failed to get VIP overview', { userId: (req as any).user?.id, error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Възникна грешка при зареждане на VIP статуса.'
      }
    });
  }
});

/**
 * GET /api/v1/vip/auctions
 * Get available auctions for SP
 * Query params: vipType (optional), categoryId (optional)
 */
router.get('/auctions', authenticateToken, checkVipEnabled, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Неоторизиран достъп.' }
      });
    }

    const filters: { vipType?: VipType; categoryId?: string } = {};
    
    if (req.query.vipType) {
      filters.vipType = req.query.vipType as VipType;
    }
    if (req.query.categoryId) {
      filters.categoryId = req.query.categoryId as string;
    }

    const auctions = await vipService.getAuctions(userId, filters);
    
    return res.json({
      success: true,
      data: {
        auctions,
        isAuctionOpen: vipService.isAuctionOpen()
      }
    });
  } catch (error) {
    logger.error('Failed to get VIP auctions', { userId: (req as any).user?.id, error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Възникна грешка при зареждане на търговете.'
      }
    });
  }
});

/**
 * POST /api/v1/vip/bid
 * Place or increase a VIP bid
 * Body: { vipType, categoryId, pointsIncrement }
 */
router.post('/bid', authenticateToken, checkVipEnabled, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Неоторизиран достъп.' }
      });
    }

    const { vipType, categoryId, pointsIncrement } = req.body;

    if (!vipType || !['HOMEPAGE_VIP', 'SEARCH_VIP'].includes(vipType)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VIP_TYPE', message: 'Невалиден тип VIP.' }
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CATEGORY', message: 'Липсва категория.' }
      });
    }

    if (!pointsIncrement || typeof pointsIncrement !== 'number' || pointsIncrement <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INCREMENT', message: 'Невалидно увеличение на точките.' }
      });
    }

    const result = await vipService.placeBid(userId, vipType as VipType, categoryId, pointsIncrement);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      data: {
        bidId: result.bidId,
        newBidAmount: result.newBidAmount,
        rank: result.rank,
        message: result.message
      }
    });
  } catch (error) {
    logger.error('Failed to place VIP bid', { userId: (req as any).user?.id, body: req.body, error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Възникна грешка при наддаването.'
      }
    });
  }
});

/**
 * POST /api/v1/vip/buyout
 * Buyout a VIP slot (immediate point deduction)
 * Body: { vipType, categoryId }
 */
router.post('/buyout', authenticateToken, checkVipEnabled, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Неоторизиран достъп.' }
      });
    }

    const { vipType, categoryId } = req.body;

    if (!vipType || !['HOMEPAGE_VIP', 'SEARCH_VIP'].includes(vipType)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VIP_TYPE', message: 'Невалиден тип VIP.' }
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CATEGORY', message: 'Липсва категория.' }
      });
    }

    const result = await vipService.buyout(userId, vipType as VipType, categoryId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      data: {
        bidId: result.bidId,
        pointsDeducted: result.pointsDeducted,
        newPointsBalance: result.newPointsBalance,
        message: result.message
      }
    });
  } catch (error) {
    logger.error('Failed to buyout VIP slot', { userId: (req as any).user?.id, body: req.body, error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Възникна грешка при закупуването.'
      }
    });
  }
});

/**
 * DELETE /api/v1/vip/bid/:bidId
 * Cancel a VIP bid (only during auction window, cannot cancel buyouts)
 */
router.delete('/bid/:bidId', authenticateToken, checkVipEnabled, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { bidId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Неоторизиран достъп.' }
      });
    }

    if (!bidId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_BID_ID', message: 'Липсва ID на офертата.' }
      });
    }

    const result = await vipService.cancelBid(userId, bidId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      data: {
        message: result.message
      }
    });
  } catch (error) {
    logger.error('Failed to cancel VIP bid', { userId: (req as any).user?.id, bidId: req.params.bidId, error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Възникна грешка при отмяната.'
      }
    });
  }
});

/**
 * GET /api/v1/vip/leaderboard
 * Get leaderboard for a VIP auction
 * Query params: vipType (required), categoryId (required), city (optional, for search)
 * Only returns data during auction window
 */
router.get('/leaderboard', authenticateToken, checkVipEnabled, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Неоторизиран достъп.' }
      });
    }

    const { vipType, categoryId, city } = req.query;

    if (!vipType || !['HOMEPAGE_VIP', 'SEARCH_VIP'].includes(vipType as string)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VIP_TYPE', message: 'Невалиден тип VIP.' }
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CATEGORY', message: 'Липсва категория.' }
      });
    }

    const leaderboard = await vipService.getLeaderboard(
      userId,
      vipType as VipType,
      categoryId as string,
      city as string | undefined
    );
    
    if (!leaderboard.isAuctionOpen) {
      return res.json({
        success: true,
        data: {
          isAuctionOpen: false,
          message: 'Търгът не е активен.'
        }
      });
    }

    return res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    logger.error('Failed to get VIP leaderboard', { userId: (req as any).user?.id, query: req.query, error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Възникна грешка при зареждане на класацията.'
      }
    });
  }
});

/**
 * POST /api/v1/vip/settle (Admin/Scheduler only)
 * Manually trigger auction settlement
 * Protected endpoint - should only be called by scheduler or admin
 */
router.post('/settle', async (req: Request, res: Response) => {
  try {
    // Basic protection: check for admin key or scheduler token
    const adminKey = req.headers['x-admin-key'] || req.headers['x-scheduler-key'];
    const expectedKey = process.env.ADMIN_API_KEY || process.env.SCHEDULER_KEY;
    
    if (!expectedKey || adminKey !== expectedKey) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      });
    }

    const result = await vipService.settleAuctions();
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to settle VIP auctions', { error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Settlement failed'
      }
    });
  }
});

export default router;
