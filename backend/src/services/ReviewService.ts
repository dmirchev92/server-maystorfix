import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import NotificationService from './NotificationService';

interface Review {
  id: string;
  case_id: string;
  customer_id: string;
  provider_id: string;
  rating: number;
  comment?: string;
  service_quality: number;
  communication: number;
  timeliness: number;
  value_for_money: number;
  would_recommend: boolean;
  created_at: string;
  updated_at: string;
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { [key: number]: number };
  categoryAverages: {
    serviceQuality: number;
    communication: number;
    timeliness: number;
    valueForMoney: number;
  };
  recommendationRate: number;
}

export class ReviewService {
  private db: any; // DatabaseFactory returns SQLiteDatabase | PostgreSQLDatabase
  private notificationService: NotificationService;

  constructor() {
    this.db = DatabaseFactory.getDatabase();
    this.notificationService = new NotificationService();
    this.initializeReviewTables();
  }

  /**
   * Initialize review tables if they don't exist
   */
  private async initializeReviewTables(): Promise<void> {
    try {
      // Create case_reviews table
      await new Promise<void>((resolve, reject) => {
        this.db.db.run(`
          CREATE TABLE IF NOT EXISTS case_reviews (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            customer_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            service_quality INTEGER CHECK (service_quality >= 1 AND service_quality <= 5),
            communication INTEGER CHECK (communication >= 1 AND communication <= 5),
            timeliness INTEGER CHECK (timeliness >= 1 AND timeliness <= 5),
            value_for_money INTEGER CHECK (value_for_money >= 1 AND value_for_money <= 5),
            would_recommend INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (case_id) REFERENCES marketplace_service_cases(id),
            FOREIGN KEY (customer_id) REFERENCES users(id),
            FOREIGN KEY (provider_id) REFERENCES users(id),
            UNIQUE(case_id, customer_id, provider_id)
          )
        `, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Create indexes for better performance
      await new Promise<void>((resolve, reject) => {
        this.db.db.run(`
          CREATE INDEX IF NOT EXISTS idx_reviews_provider 
          ON case_reviews(provider_id, created_at)
        `, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise<void>((resolve, reject) => {
        this.db.db.run(`
          CREATE INDEX IF NOT EXISTS idx_reviews_customer 
          ON case_reviews(customer_id, created_at)
        `, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info('✅ Review tables initialized');
    } catch (error) {
      logger.error('❌ Error initializing review tables:', error);
    }
  }

  /**
   * Create a new review
   */
  async createReview(reviewData: {
    caseId: string;
    customerId: string;
    providerId: string;
    rating: number;
    comment?: string;
    serviceQuality?: number;
    communication?: number;
    timeliness?: number;
    valueForMoney?: number;
    wouldRecommend?: boolean;
  }): Promise<string> {
    try {
      // Validate that case exists and is completed
      const caseExists = await new Promise<boolean>((resolve, reject) => {
        this.db.db.get(
          `SELECT id FROM marketplace_service_cases 
           WHERE id = ? AND customer_id = ? AND provider_id = ? AND status = 'completed'`,
          [reviewData.caseId, reviewData.customerId, reviewData.providerId],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(!!row);
          }
        );
      });

      if (!caseExists) {
        throw new Error('Case not found or not completed');
      }

      // Check if review already exists (with detailed logging)
      const existingReview = await new Promise<any>((resolve, reject) => {
        this.db.db.get(
          'SELECT id, created_at FROM case_reviews WHERE case_id = ? AND customer_id = ? AND provider_id = ?',
          [reviewData.caseId, reviewData.customerId, reviewData.providerId],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (existingReview) {
        logger.warn('⚠️ Duplicate review attempt blocked', {
          existingReviewId: existingReview.id,
          existingCreatedAt: existingReview.created_at,
          caseId: reviewData.caseId,
          customerId: reviewData.customerId,
          providerId: reviewData.providerId
        });
        throw new Error('Review already exists for this case');
      }

      const reviewId = uuidv4();
      const now = new Date().toISOString();

      // Insert review
      await new Promise<void>((resolve, reject) => {
        this.db.db.run(
          `INSERT INTO case_reviews (
            id, case_id, customer_id, provider_id, rating, comment,
            service_quality, communication, timeliness, value_for_money,
            would_recommend, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reviewId,
            reviewData.caseId,
            reviewData.customerId,
            reviewData.providerId,
            reviewData.rating,
            reviewData.comment || null,
            reviewData.serviceQuality || reviewData.rating,
            reviewData.communication || reviewData.rating,
            reviewData.timeliness || reviewData.rating,
            reviewData.valueForMoney || reviewData.rating,
            reviewData.wouldRecommend ? 1 : 0,
            now,
            now
          ],
          function(err: Error | null) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      logger.info('✅ Review created successfully', { 
        reviewId, 
        caseId: reviewData.caseId,
        rating: reviewData.rating 
      });

      return reviewId;

    } catch (error) {
      logger.error('❌ Error creating review:', error);
      throw error;
    }
  }

  /**
   * Get reviews for a provider
   */
  async getProviderReviews(
    providerId: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<{ reviews: Review[], total: number }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await this.db.query(
        'SELECT COUNT(*) as count FROM case_reviews WHERE provider_id = $1',
        [providerId]
      );
      const total = parseInt(countResult[0]?.count || '0');

      // Get reviews with customer info
      const reviews = await this.db.query(
        `SELECT r.*, u.first_name, u.last_name,
                CONCAT(u.first_name, ' ', u.last_name) as customer_name
         FROM case_reviews r
         JOIN users u ON r.customer_id = u.id
         WHERE r.provider_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [providerId, limit, offset]
      );

      return { reviews, total };

    } catch (error) {
      logger.error('❌ Error getting provider reviews:', error);
      throw error;
    }
  }

  /**
   * Get review statistics for a provider
   */
  async getProviderReviewStats(providerId: string): Promise<ReviewStats> {
    try {
      // Get basic stats
      const basicStatsResult = await this.db.query(
        `SELECT 
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating,
          AVG(service_quality) as avg_service_quality,
          AVG(communication) as avg_communication,
          AVG(timeliness) as avg_timeliness,
          AVG(value_for_money) as avg_value_for_money,
          AVG(CASE WHEN would_recommend = 1 THEN 1 ELSE 0 END) as recommendation_rate
         FROM case_reviews 
         WHERE provider_id = $1`,
        [providerId]
      );
      const basicStats = basicStatsResult[0] || {};

      // Get rating distribution
      const distributionResult = await this.db.query(
        `SELECT rating, COUNT(*) as count 
         FROM case_reviews 
         WHERE provider_id = $1
         GROUP BY rating`,
        [providerId]
      );
      
      const ratingDistribution: { [key: number]: number } = {};
      distributionResult.forEach((row: any) => {
        ratingDistribution[row.rating] = parseInt(row.count);
      });

      return {
        averageRating: Number(parseFloat(basicStats?.average_rating || '0').toFixed(2)),
        totalReviews: parseInt(basicStats?.total_reviews || '0'),
        ratingDistribution,
        categoryAverages: {
          serviceQuality: Number(parseFloat(basicStats?.avg_service_quality || '0').toFixed(2)),
          communication: Number(parseFloat(basicStats?.avg_communication || '0').toFixed(2)),
          timeliness: Number(parseFloat(basicStats?.avg_timeliness || '0').toFixed(2)),
          valueForMoney: Number(parseFloat(basicStats?.avg_value_for_money || '0').toFixed(2))
        },
        recommendationRate: Number(parseFloat(basicStats?.recommendation_rate || '0').toFixed(2))
      };

    } catch (error) {
      logger.error('❌ Error getting provider review stats:', error);
      throw error;
    }
  }

  /**
   * Check if customer can review a case
   */
  async canReviewCase(caseId: string, customerId: string): Promise<boolean> {
    try {
      const result = await new Promise<any>((resolve, reject) => {
        this.db.db.get(
          `SELECT 
            CASE WHEN c.status = 'completed' AND c.customer_id = ? AND r.id IS NULL 
            THEN 1 ELSE 0 END as can_review
           FROM marketplace_service_cases c
           LEFT JOIN case_reviews r ON c.id = r.case_id AND r.customer_id = ?
           WHERE c.id = ?`,
          [customerId, customerId, caseId],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      return !!result?.can_review;

    } catch (error) {
      logger.error('❌ Error checking review eligibility:', error);
      return false;
    }
  }

  /**
   * Get pending reviews for customer (completed cases without reviews)
   */
  async getPendingReviews(customerId: string): Promise<any[]> {
    try {
      const pendingReviews = await new Promise<any[]>((resolve, reject) => {
        this.db.db.all(
          `SELECT c.id, c.description, c.provider_name, c.completed_at, c.provider_id
           FROM marketplace_service_cases c
           LEFT JOIN case_reviews r ON c.id = r.case_id AND r.customer_id = ?
           WHERE c.customer_id = ? 
             AND c.status = 'completed' 
             AND r.id IS NULL
           ORDER BY c.completed_at DESC`,
          [customerId, customerId],
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      return pendingReviews;

    } catch (error) {
      logger.error('❌ Error getting pending reviews:', error);
      throw error;
    }
  }

  /**
   * Send review request notification
   */
  async sendReviewRequest(caseId: string, customerId: string, providerName: string): Promise<void> {
    try {
      await this.notificationService.notifyReviewRequest(caseId, customerId, providerName);
      logger.info('✅ Review request notification sent', { caseId, customerId });
    } catch (error) {
      logger.error('❌ Error sending review request:', error);
    }
  }

  /**
   * Update provider's cached rating (for performance)
   */
  async updateProviderRating(providerId: string): Promise<void> {
    try {
      console.log('🔄 Getting stats for provider:', providerId);
      const stats = await this.getProviderReviewStats(providerId);
      console.log('📊 Stats retrieved:', stats);
      
      // Update service_provider_profiles table with latest rating
      console.log('💾 Updating profile with:', { rating: stats.averageRating, totalReviews: stats.totalReviews, providerId });
      const result = await this.db.query(
        `UPDATE service_provider_profiles 
         SET rating = $1, total_reviews = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [stats.averageRating, stats.totalReviews, providerId]
      );
      console.log('✅ Update result:', result);

      logger.info('✅ Provider rating updated', { 
        providerId, 
        rating: stats.averageRating, 
        totalReviews: stats.totalReviews 
      });

    } catch (error) {
      console.error('❌ FULL Error updating provider rating:', error);
      logger.error('❌ Error updating provider rating:', error);
      throw error;
    }
  }
}

export default ReviewService;
