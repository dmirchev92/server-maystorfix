"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const logger_1 = __importDefault(require("../utils/logger"));
const uuid_1 = require("uuid");
const NotificationService_1 = __importDefault(require("./NotificationService"));
class ReviewService {
    constructor() {
        this.db = DatabaseFactory_1.DatabaseFactory.getDatabase();
        this.notificationService = new NotificationService_1.default();
        this.initializeReviewTables();
    }
    async initializeReviewTables() {
        try {
            await new Promise((resolve, reject) => {
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
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await new Promise((resolve, reject) => {
                this.db.db.run(`
          CREATE INDEX IF NOT EXISTS idx_reviews_provider 
          ON case_reviews(provider_id, created_at)
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await new Promise((resolve, reject) => {
                this.db.db.run(`
          CREATE INDEX IF NOT EXISTS idx_reviews_customer 
          ON case_reviews(customer_id, created_at)
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('✅ Review tables initialized');
        }
        catch (error) {
            logger_1.default.error('❌ Error initializing review tables:', error);
        }
    }
    async createReview(reviewData) {
        try {
            const caseExists = await new Promise((resolve, reject) => {
                this.db.db.get(`SELECT id FROM marketplace_service_cases 
           WHERE id = ? AND customer_id = ? AND provider_id = ? AND status = 'completed'`, [reviewData.caseId, reviewData.customerId, reviewData.providerId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(!!row);
                });
            });
            if (!caseExists) {
                throw new Error('Case not found or not completed');
            }
            const existingReview = await new Promise((resolve, reject) => {
                this.db.db.get('SELECT id, created_at FROM case_reviews WHERE case_id = ? AND customer_id = ? AND provider_id = ?', [reviewData.caseId, reviewData.customerId, reviewData.providerId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });
            });
            if (existingReview) {
                logger_1.default.warn('⚠️ Duplicate review attempt blocked', {
                    existingReviewId: existingReview.id,
                    existingCreatedAt: existingReview.created_at,
                    caseId: reviewData.caseId,
                    customerId: reviewData.customerId,
                    providerId: reviewData.providerId
                });
                throw new Error('Review already exists for this case');
            }
            const reviewId = (0, uuid_1.v4)();
            const now = new Date().toISOString();
            await new Promise((resolve, reject) => {
                this.db.db.run(`INSERT INTO case_reviews (
            id, case_id, customer_id, provider_id, rating, comment,
            service_quality, communication, timeliness, value_for_money,
            would_recommend, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
                ], function (err) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('✅ Review created successfully', {
                reviewId,
                caseId: reviewData.caseId,
                rating: reviewData.rating
            });
            return reviewId;
        }
        catch (error) {
            logger_1.default.error('❌ Error creating review:', error);
            throw error;
        }
    }
    async getProviderReviews(providerId, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;
            const total = await new Promise((resolve, reject) => {
                this.db.db.get('SELECT COUNT(*) as count FROM case_reviews WHERE provider_id = ?', [providerId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.count || 0);
                });
            });
            const reviews = await new Promise((resolve, reject) => {
                this.db.db.all(`SELECT r.*, u.first_name, u.last_name 
           FROM case_reviews r
           JOIN users u ON r.customer_id = u.id
           WHERE r.provider_id = ?
           ORDER BY r.created_at DESC
           LIMIT ? OFFSET ?`, [providerId, limit, offset], (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            });
            return { reviews, total };
        }
        catch (error) {
            logger_1.default.error('❌ Error getting provider reviews:', error);
            throw error;
        }
    }
    async getProviderReviewStats(providerId) {
        try {
            const basicStats = await new Promise((resolve, reject) => {
                this.db.db.get(`SELECT 
            COUNT(*) as total_reviews,
            AVG(rating) as average_rating,
            AVG(service_quality) as avg_service_quality,
            AVG(communication) as avg_communication,
            AVG(timeliness) as avg_timeliness,
            AVG(value_for_money) as avg_value_for_money,
            AVG(CASE WHEN would_recommend THEN 1 ELSE 0 END) as recommendation_rate
           FROM case_reviews 
           WHERE provider_id = ?`, [providerId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });
            });
            const ratingDistribution = await new Promise((resolve, reject) => {
                this.db.db.all(`SELECT rating, COUNT(*) as count 
           FROM case_reviews 
           WHERE provider_id = ? 
           GROUP BY rating`, [providerId], (err, rows) => {
                    if (err)
                        reject(err);
                    else {
                        const distribution = {};
                        rows.forEach(row => {
                            distribution[row.rating] = row.count;
                        });
                        resolve(distribution);
                    }
                });
            });
            return {
                averageRating: Number((basicStats?.average_rating || 0).toFixed(2)),
                totalReviews: basicStats?.total_reviews || 0,
                ratingDistribution,
                categoryAverages: {
                    serviceQuality: Number((basicStats?.avg_service_quality || 0).toFixed(2)),
                    communication: Number((basicStats?.avg_communication || 0).toFixed(2)),
                    timeliness: Number((basicStats?.avg_timeliness || 0).toFixed(2)),
                    valueForMoney: Number((basicStats?.avg_value_for_money || 0).toFixed(2))
                },
                recommendationRate: Number((basicStats?.recommendation_rate || 0).toFixed(2))
            };
        }
        catch (error) {
            logger_1.default.error('❌ Error getting provider review stats:', error);
            throw error;
        }
    }
    async canReviewCase(caseId, customerId) {
        try {
            const result = await new Promise((resolve, reject) => {
                this.db.db.get(`SELECT 
            CASE WHEN c.status = 'completed' AND c.customer_id = ? AND r.id IS NULL 
            THEN 1 ELSE 0 END as can_review
           FROM marketplace_service_cases c
           LEFT JOIN case_reviews r ON c.id = r.case_id AND r.customer_id = ?
           WHERE c.id = ?`, [customerId, customerId, caseId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });
            });
            return !!result?.can_review;
        }
        catch (error) {
            logger_1.default.error('❌ Error checking review eligibility:', error);
            return false;
        }
    }
    async getPendingReviews(customerId) {
        try {
            const pendingReviews = await new Promise((resolve, reject) => {
                this.db.db.all(`SELECT c.id, c.description, c.provider_name, c.completed_at, c.provider_id
           FROM marketplace_service_cases c
           LEFT JOIN case_reviews r ON c.id = r.case_id AND r.customer_id = ?
           WHERE c.customer_id = ? 
             AND c.status = 'completed' 
             AND r.id IS NULL
           ORDER BY c.completed_at DESC`, [customerId, customerId], (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            });
            return pendingReviews;
        }
        catch (error) {
            logger_1.default.error('❌ Error getting pending reviews:', error);
            throw error;
        }
    }
    async sendReviewRequest(caseId, customerId, providerName) {
        try {
            await this.notificationService.notifyReviewRequest(caseId, customerId, providerName);
            logger_1.default.info('✅ Review request notification sent', { caseId, customerId });
        }
        catch (error) {
            logger_1.default.error('❌ Error sending review request:', error);
        }
    }
    async updateProviderRating(providerId) {
        try {
            const stats = await this.getProviderReviewStats(providerId);
            await new Promise((resolve, reject) => {
                this.db.db.run(`UPDATE service_provider_profiles 
           SET rating = ?, total_reviews = ?, updated_at = datetime('now')
           WHERE user_id = ?`, [stats.averageRating, stats.totalReviews, providerId], function (err) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('✅ Provider rating updated', {
                providerId,
                rating: stats.averageRating,
                totalReviews: stats.totalReviews
            });
        }
        catch (error) {
            logger_1.default.error('❌ Error updating provider rating:', error);
        }
    }
}
exports.ReviewService = ReviewService;
exports.default = ReviewService;
//# sourceMappingURL=ReviewService.js.map