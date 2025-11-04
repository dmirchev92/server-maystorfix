import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth';
import { BiddingService } from '../services/BiddingService';
import logger from '../utils/logger';

// Initialize bidding service with database pool
let biddingService: BiddingService;

export function initializeBiddingController(pool: Pool) {
  const router = Router();
  biddingService = new BiddingService(pool);

/**
 * @route   GET /api/v1/bidding/case/:caseId/can-bid
 * @desc    Check if provider can bid on a case
 * @access  Private (Service Provider)
 */
router.get('/case/:caseId/can-bid', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
    }

    const result = await biddingService.canProviderBid(caseId, userId);

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    logger.error('Error checking bid eligibility', { error, caseId: req.params.caseId });
    res.status(500).json({
      success: false,
      error: {
        code: 'BID_CHECK_FAILED',
        message: error.message || 'Failed to check bid eligibility'
      }
    });
  }
});

/**
 * @route   POST /api/v1/bidding/case/:caseId/bid
 * @desc    Place a bid on a case
 * @access  Private (Service Provider)
 */
router.post('/case/:caseId/bid', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
    }

    const result = await biddingService.placeBid(caseId, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BID_PLACEMENT_FAILED',
          message: result.message
        }
      });
    }

    res.json({
      success: true,
      data: result,
      message: result.message
    });

  } catch (error: any) {
    logger.error('Error placing bid', { error, caseId: req.params.caseId });
    res.status(500).json({
      success: false,
      error: {
        code: 'BID_PLACEMENT_ERROR',
        message: error.message || 'Failed to place bid'
      }
    });
  }
});

/**
 * @route   GET /api/v1/bidding/case/:caseId/bids
 * @desc    Get all bids for a case
 * @access  Private (Case Owner or Admin)
 */
router.get('/case/:caseId/bids', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const userId = (req as any).user?.id;
    const includeProviderInfo = req.query.includeProviderInfo === 'true';

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
    }

    // TODO: Verify user is case owner or admin
    // For now, we'll allow authenticated users

    const bids = await biddingService.getCaseBids(caseId, includeProviderInfo);

    res.json({
      success: true,
      data: {
        bids,
        count: bids.length
      }
    });

  } catch (error: any) {
    logger.error('Error getting case bids', { error, caseId: req.params.caseId });
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_BIDS_FAILED',
        message: error.message || 'Failed to get case bids'
      }
    });
  }
});

/**
 * @route   POST /api/v1/bidding/case/:caseId/select-winner
 * @desc    Customer selects winning bid
 * @access  Private (Case Owner)
 */
router.post('/case/:caseId/select-winner', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const { winning_bid_id } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
    }

    if (!winning_bid_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_BID_ID',
          message: 'Winning bid ID is required'
        }
      });
    }

    const result = await biddingService.selectWinningBid(caseId, winning_bid_id, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WINNER_SELECTION_FAILED',
          message: result.message
        }
      });
    }

    res.json({
      success: true,
      data: result,
      message: result.message
    });

  } catch (error: any) {
    logger.error('Error selecting winner', { error, caseId: req.params.caseId });
    res.status(500).json({
      success: false,
      error: {
        code: 'WINNER_SELECTION_ERROR',
        message: error.message || 'Failed to select winner'
      }
    });
  }
});

/**
 * @route   GET /api/v1/bidding/my-bids
 * @desc    Get provider's bids
 * @access  Private (Service Provider)
 */
router.get('/my-bids', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const status = req.query.status as string | undefined;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
    }

    const bids = await biddingService.getProviderBids(userId, status);

    res.json({
      success: true,
      data: {
        bids,
        count: bids.length
      }
    });

  } catch (error: any) {
    logger.error('Error getting provider bids', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_MY_BIDS_FAILED',
        message: error.message || 'Failed to get your bids'
      }
    });
  }
});

/**
 * @route   DELETE /api/v1/bidding/bid/:bidId
 * @desc    Cancel a bid
 * @access  Private (Bid Owner)
 */
router.delete('/bid/:bidId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { bidId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
    }

    const result = await biddingService.cancelBid(bidId, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BID_CANCELLATION_FAILED',
          message: result.message
        }
      });
    }

    res.json({
      success: true,
      message: result.message
    });

  } catch (error: any) {
    logger.error('Error cancelling bid', { error, bidId: req.params.bidId });
    res.status(500).json({
      success: false,
      error: {
        code: 'BID_CANCELLATION_ERROR',
        message: error.message || 'Failed to cancel bid'
      }
    });
  }
});

  return router;
}
