import { Request, Response } from 'express';
import ReviewService from '../services/ReviewService';
import logger from '../utils/logger';
import {
  unauthorized,
  missingParameters,
  badRequest,
  forbidden,
  reviewExists,
  caseNotFound
} from '../utils/errorHelpers';

const reviewService = new ReviewService();

/**
 * Create a new review
 */
export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id; // From auth middleware
    const {
      caseId,
      providerId,
      rating,
      comment,
      serviceQuality,
      communication,
      timeliness,
      valueForMoney,
      wouldRecommend
    } = req.body;

    if (!userId) {
      throw unauthorized('User not authenticated');
    }

    // Validate required fields
    if (!caseId || !providerId || !rating) {
      throw missingParameters(['caseId', 'providerId', 'rating']);
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      throw badRequest('Rating must be between 1 and 5');
    }

    // Prevent Service Providers from reviewing themselves
    if (userId === providerId) {
      logger.warn('⚠️ Service Provider attempted to review themselves:', {
        userId,
        providerId
      });
      throw forbidden('Service Providers cannot leave reviews for themselves');
    }

    const reviewId = await reviewService.createReview({
      caseId,
      customerId: userId,
      providerId,
      rating,
      comment,
      serviceQuality,
      communication,
      timeliness,
      valueForMoney,
      wouldRecommend
    });

    // Update provider's cached rating
    await reviewService.updateProviderRating(providerId);

    res.status(201).json({
      success: true,
      data: {
        reviewId,
        message: 'Review created successfully'
      }
    });

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        throw reviewExists(req.body.caseId);
      }
      
      if (error.message.includes('not found') || error.message.includes('not completed')) {
        throw caseNotFound(req.body.caseId);
      }
    }
    throw error;
  }
};

/**
 * Get reviews for a provider
 */
export const getProviderReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!providerId) {
      throw missingParameters(['providerId']);
    }

    const result = await reviewService.getProviderReviews(
      providerId,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: {
        reviews: result.reviews,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.total,
          totalPages: Math.ceil(result.total / Number(limit))
        }
      }
    });

  } catch (error) {
    throw error;
  }
};

/**
 * Get review statistics for a provider
 */
export const getProviderReviewStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;

    if (!providerId) {
      throw missingParameters(['providerId']);
    }

    const stats = await reviewService.getProviderReviewStats(providerId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    throw error;
  }
};

/**
 * Check if user can review a case
 */
export const canReviewCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { caseId } = req.params;

    if (!userId) {
      throw unauthorized('User not authenticated');
    }

    if (!caseId) {
      throw missingParameters(['caseId']);
    }

    const canReview = await reviewService.canReviewCase(caseId, userId);

    res.json({
      success: true,
      data: { canReview }
    });

  } catch (error) {
    throw error;
  }
};

/**
 * Get pending reviews for authenticated user
 */
export const getPendingReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
      return;
    }

    const pendingReviews = await reviewService.getPendingReviews(userId);

    res.json({
      success: true,
      data: { pendingReviews }
    });

  } catch (error) {
    throw error;
  }
};

/**
 * Update provider rating (recalculate from reviews)
 */
export const updateProviderRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;

    if (!providerId) {
      throw missingParameters(['providerId']);
    }

    await reviewService.updateProviderRating(providerId);

    res.json({
      success: true,
      data: {
        message: 'Provider rating updated successfully'
      }
    });

  } catch (error) {
    throw error;
  }
};

/**
 * Send review request notification
 */
export const sendReviewRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId, customerId, providerName } = req.body;

    if (!caseId || !customerId || !providerName) {
      throw missingParameters(['caseId', 'customerId', 'providerName']);
    }

    await reviewService.sendReviewRequest(caseId, customerId, providerName);

    res.json({
      success: true,
      data: {
        message: 'Review request sent successfully'
      }
    });

  } catch (error) {
    throw error;
  }
};
