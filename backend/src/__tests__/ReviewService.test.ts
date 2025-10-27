/**
 * Unit Tests for ReviewService
 * Tests review creation, validation, and statistics
 */

import { ReviewService } from '../services/ReviewService';
import { DatabaseFactory } from '../models/DatabaseFactory';
import NotificationService from '../services/NotificationService';
import logger from '../utils/logger';

// Mock dependencies
jest.mock('../models/DatabaseFactory');
jest.mock('../services/NotificationService');
jest.mock('../utils/logger');

describe('ReviewService', () => {
  let reviewService: ReviewService;
  let mockDb: any;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    // Setup mock database
    mockDb = {
      db: {
        run: jest.fn((sql: string, params: any, callback: Function) => {
          callback(null);
        }),
        get: jest.fn((sql: string, params: any, callback: Function) => {
          callback(null, null);
        }),
        all: jest.fn((sql: string, params: any, callback: Function) => {
          callback(null, []);
        })
      }
    };

    // Setup mock notification service
    mockNotificationService = {
      createNotification: jest.fn().mockResolvedValue('notification-123'),
      sendSurveyToChat: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock DatabaseFactory
    (DatabaseFactory.getDatabase as jest.Mock) = jest.fn().mockReturnValue(mockDb);
    
    // Mock NotificationService constructor
    (NotificationService as jest.MockedClass<typeof NotificationService>).mockImplementation(() => mockNotificationService);

    // Create service instance
    reviewService = new ReviewService();
    
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    const validReviewData = {
      caseId: 'case-123',
      customerId: 'customer-123',
      providerId: 'provider-123',
      rating: 5,
      comment: 'Excellent service!',
      serviceQuality: 5,
      communication: 5,
      timeliness: 5,
      valueForMoney: 5,
      wouldRecommend: true
    };

    it('should create review with valid data', async () => {
      // Mock case exists and is completed
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { id: 'case-123' });
      });

      // Mock no existing review
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, null);
      });

      // Mock successful insert
      mockDb.db.run.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null);
      });

      const reviewId = await reviewService.createReview(validReviewData);

      expect(reviewId).toBeDefined();
      expect(typeof reviewId).toBe('string');
      expect(mockDb.db.run).toHaveBeenCalled();
    });

    it('should reject review for non-existent case', async () => {
      // Mock case doesn't exist
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, null);
      });

      await expect(reviewService.createReview(validReviewData))
        .rejects
        .toThrow('Case not found or not completed');
    });

    it('should reject duplicate review', async () => {
      // Mock case exists
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { id: 'case-123' });
      });

      // Mock existing review
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { 
          id: 'review-123', 
          created_at: '2025-01-01T00:00:00.000Z' 
        });
      });

      await expect(reviewService.createReview(validReviewData))
        .rejects
        .toThrow('Review already exists for this case');
    });

    it('should use rating as default for category ratings', async () => {
      const minimalReviewData = {
        caseId: 'case-123',
        customerId: 'customer-123',
        providerId: 'provider-123',
        rating: 4
      };

      // Mock case exists
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { id: 'case-123' });
      });

      // Mock no existing review
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, null);
      });

      // Capture insert parameters
      let insertParams: any[] = [];
      mockDb.db.run.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        insertParams = params;
        callback(null);
      });

      await reviewService.createReview(minimalReviewData);

      // Verify that rating (4) was used for all category ratings
      expect(insertParams[6]).toBe(4); // service_quality
      expect(insertParams[7]).toBe(4); // communication
      expect(insertParams[8]).toBe(4); // timeliness
      expect(insertParams[9]).toBe(4); // value_for_money
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(new Error('Database connection failed'), null);
      });

      await expect(reviewService.createReview(validReviewData))
        .rejects
        .toThrow('Database connection failed');
    });
  });

  describe('getProviderReviews', () => {
    it('should return paginated reviews', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          comment: 'Great!',
          first_name: 'John',
          last_name: 'Doe'
        },
        {
          id: 'review-2',
          rating: 4,
          comment: 'Good',
          first_name: 'Jane',
          last_name: 'Smith'
        }
      ];

      // Mock count query
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { count: 10 });
      });

      // Mock reviews query
      mockDb.db.all.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, mockReviews);
      });

      const result = await reviewService.getProviderReviews('provider-123', 1, 10);

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.reviews[0].id).toBe('review-1');
    });

    it('should return empty array when no reviews exist', async () => {
      // Mock count query
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { count: 0 });
      });

      // Mock empty reviews
      mockDb.db.all.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, []);
      });

      const result = await reviewService.getProviderReviews('provider-123');

      expect(result.reviews).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle pagination correctly', async () => {
      // Mock count
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { count: 25 });
      });

      // Capture pagination parameters
      let paginationParams: any[] = [];
      mockDb.db.all.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        paginationParams = params;
        callback(null, []);
      });

      await reviewService.getProviderReviews('provider-123', 3, 10);

      // Verify correct offset calculation: (page - 1) * limit = (3 - 1) * 10 = 20
      expect(paginationParams[1]).toBe(10); // limit
      expect(paginationParams[2]).toBe(20); // offset
    });
  });

  describe('getProviderReviewStats', () => {
    it('should return provider review statistics', async () => {
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, {
          total_reviews: 10,
          average_rating: 4.5,
          avg_service_quality: 4.6,
          avg_communication: 4.7,
          avg_timeliness: 4.3,
          avg_value_for_money: 4.4,
          recommendation_rate: 0.9
        });
      });

      mockDb.db.all.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, [
          { rating: 5, count: 6 },
          { rating: 4, count: 3 },
          { rating: 3, count: 1 }
        ]);
      });

      const stats = await reviewService.getProviderReviewStats('provider-123');

      // Numbers are converted with toFixed(2) so use toBeCloseTo
      expect(stats.averageRating).toBeCloseTo(4.5, 2);
      expect(stats.totalReviews).toBe(10);
      expect(stats.categoryAverages.serviceQuality).toBeCloseTo(4.6, 2);
      expect(stats.categoryAverages.communication).toBeCloseTo(4.7, 2);
      expect(stats.categoryAverages.timeliness).toBeCloseTo(4.3, 2);
      expect(stats.categoryAverages.valueForMoney).toBeCloseTo(4.4, 2);
      expect(stats.recommendationRate).toBeCloseTo(0.9, 2); // Stored as decimal, not percentage
    });

    it('should return zero stats when no reviews exist', async () => {
      // Mock no stats
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, {
          avg_rating: null,
          total_reviews: 0,
          avg_service_quality: null,
          avg_communication: null,
          avg_timeliness: null,
          avg_value_for_money: null,
          recommendation_count: 0
        });
      });

      // Mock empty distribution
      mockDb.db.all.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, []);
      });

      const stats = await reviewService.getProviderReviewStats('provider-123');

      expect(stats.averageRating).toBe(0);
      expect(stats.totalReviews).toBe(0);
      expect(stats.recommendationRate).toBe(0);
    });

    it('should build rating distribution correctly', async () => {
      // Mock stats
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { avg_rating: 4, total_reviews: 5 });
      });

      // Mock rating distribution
      mockDb.db.all.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, [
          { rating: 5, count: 2 },
          { rating: 4, count: 2 },
          { rating: 3, count: 1 }
        ]);
      });

      const stats = await reviewService.getProviderReviewStats('provider-123');

      expect(stats.ratingDistribution[5]).toBe(2);
      expect(stats.ratingDistribution[4]).toBe(2);
      expect(stats.ratingDistribution[3]).toBe(1);
    });
  });

  describe('canReviewCase', () => {
    it('should return true for completed case without review', async () => {
      // Mock the single query that checks both case status and review existence
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { can_review: 1 }); // Returns 1 if can review, 0 if cannot
      });

      const canReview = await reviewService.canReviewCase('case-123', 'customer-123');

      expect(canReview).toBe(true);
    });

    it('should return false for non-completed case', async () => {
      // Mock non-completed case
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, null);
      });

      const canReview = await reviewService.canReviewCase('case-123', 'customer-123');

      expect(canReview).toBe(false);
    });

    it('should return false when review already exists', async () => {
      // Mock completed case
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { id: 'case-123', status: 'completed' });
      });

      // Mock existing review
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { id: 'review-123' });
      });

      const canReview = await reviewService.canReviewCase('case-123', 'customer-123');

      expect(canReview).toBe(false);
    });
  });

  describe('getPendingReviews', () => {
    it('should return completed cases without reviews', async () => {
      const mockCases = [
        {
          id: 'case-1',
          provider_id: 'provider-1',
          provider_name: 'John Doe',
          completed_at: '2025-01-01T00:00:00.000Z'
        },
        {
          id: 'case-2',
          provider_id: 'provider-2',
          provider_name: 'Jane Smith',
          completed_at: '2025-01-02T00:00:00.000Z'
        }
      ];

      mockDb.db.all.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, mockCases);
      });

      const pendingReviews = await reviewService.getPendingReviews('customer-123');

      expect(pendingReviews).toHaveLength(2);
      expect(pendingReviews[0].id).toBe('case-1');
      expect(pendingReviews[1].id).toBe('case-2');
    });

    it('should return empty array when no pending reviews', async () => {
      mockDb.db.all.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, []);
      });

      const pendingReviews = await reviewService.getPendingReviews('customer-123');

      expect(pendingReviews).toEqual([]);
    });
  });

  describe('updateProviderRating', () => {
    it('should update provider cached rating', async () => {
      // Mock get average rating
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { avg_rating: 4.5, total_reviews: 10 });
      });

      // Mock update query
      mockDb.db.run.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null);
      });

      await reviewService.updateProviderRating('provider-123');

      expect(mockDb.db.run).toHaveBeenCalled();
    });

    it('should handle provider with no reviews', async () => {
      // Mock no reviews
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null, { avg_rating: null, total_reviews: 0 });
      });

      // Mock update query
      mockDb.db.run.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(null);
      });

      await reviewService.updateProviderRating('provider-123');

      expect(mockDb.db.run).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in getProviderReviews', async () => {
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(new Error('Database error'), null);
      });

      await expect(reviewService.getProviderReviews('provider-123'))
        .rejects
        .toThrow('Database error');
    });

    it('should handle database errors in getProviderReviewStats', async () => {
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(new Error('Stats query failed'), null);
      });

      await expect(reviewService.getProviderReviewStats('provider-123'))
        .rejects
        .toThrow('Stats query failed');
    });

    it('should handle database errors in canReviewCase', async () => {
      mockDb.db.get.mockImplementationOnce((sql: string, params: any, callback: Function) => {
        callback(new Error('Case lookup failed'), null);
      });

      // canReviewCase returns false on error, doesn't throw
      const result = await reviewService.canReviewCase('case-123', 'customer-123');
      expect(result).toBe(false);
    });
  });
});
