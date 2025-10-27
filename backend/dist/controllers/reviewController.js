"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendReviewRequest = exports.updateProviderRating = exports.getPendingReviews = exports.canReviewCase = exports.getProviderReviewStats = exports.getProviderReviews = exports.createReview = void 0;
const ReviewService_1 = __importDefault(require("../services/ReviewService"));
const logger_1 = __importDefault(require("../utils/logger"));
const errorHelpers_1 = require("../utils/errorHelpers");
const reviewService = new ReviewService_1.default();
const createReview = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { caseId, providerId, rating, comment, serviceQuality, communication, timeliness, valueForMoney, wouldRecommend } = req.body;
        if (!userId) {
            throw (0, errorHelpers_1.unauthorized)('User not authenticated');
        }
        if (!caseId || !providerId || !rating) {
            throw (0, errorHelpers_1.missingParameters)(['caseId', 'providerId', 'rating']);
        }
        if (rating < 1 || rating > 5) {
            throw (0, errorHelpers_1.badRequest)('Rating must be between 1 and 5');
        }
        if (userId === providerId) {
            logger_1.default.warn('⚠️ Service Provider attempted to review themselves:', {
                userId,
                providerId
            });
            throw (0, errorHelpers_1.forbidden)('Service Providers cannot leave reviews for themselves');
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
        await reviewService.updateProviderRating(providerId);
        res.status(201).json({
            success: true,
            data: {
                reviewId,
                message: 'Review created successfully'
            }
        });
    }
    catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('already exists')) {
                throw (0, errorHelpers_1.reviewExists)(req.body.caseId);
            }
            if (error.message.includes('not found') || error.message.includes('not completed')) {
                throw (0, errorHelpers_1.caseNotFound)(req.body.caseId);
            }
        }
        throw error;
    }
};
exports.createReview = createReview;
const getProviderReviews = async (req, res) => {
    try {
        const { providerId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        if (!providerId) {
            throw (0, errorHelpers_1.missingParameters)(['providerId']);
        }
        const result = await reviewService.getProviderReviews(providerId, Number(page), Number(limit));
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
    }
    catch (error) {
        throw error;
    }
};
exports.getProviderReviews = getProviderReviews;
const getProviderReviewStats = async (req, res) => {
    try {
        const { providerId } = req.params;
        if (!providerId) {
            throw (0, errorHelpers_1.missingParameters)(['providerId']);
        }
        const stats = await reviewService.getProviderReviewStats(providerId);
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        throw error;
    }
};
exports.getProviderReviewStats = getProviderReviewStats;
const canReviewCase = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { caseId } = req.params;
        if (!userId) {
            throw (0, errorHelpers_1.unauthorized)('User not authenticated');
        }
        if (!caseId) {
            throw (0, errorHelpers_1.missingParameters)(['caseId']);
        }
        const canReview = await reviewService.canReviewCase(caseId, userId);
        res.json({
            success: true,
            data: { canReview }
        });
    }
    catch (error) {
        throw error;
    }
};
exports.canReviewCase = canReviewCase;
const getPendingReviews = async (req, res) => {
    try {
        const userId = req.user?.id;
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
    }
    catch (error) {
        throw error;
    }
};
exports.getPendingReviews = getPendingReviews;
const updateProviderRating = async (req, res) => {
    try {
        const { providerId } = req.params;
        if (!providerId) {
            throw (0, errorHelpers_1.missingParameters)(['providerId']);
        }
        await reviewService.updateProviderRating(providerId);
        res.json({
            success: true,
            data: {
                message: 'Provider rating updated successfully'
            }
        });
    }
    catch (error) {
        throw error;
    }
};
exports.updateProviderRating = updateProviderRating;
const sendReviewRequest = async (req, res) => {
    try {
        const { caseId, customerId, providerName } = req.body;
        if (!caseId || !customerId || !providerName) {
            throw (0, errorHelpers_1.missingParameters)(['caseId', 'customerId', 'providerName']);
        }
        await reviewService.sendReviewRequest(caseId, customerId, providerName);
        res.json({
            success: true,
            data: {
                message: 'Review request sent successfully'
            }
        });
    }
    catch (error) {
        throw error;
    }
};
exports.sendReviewRequest = sendReviewRequest;
//# sourceMappingURL=reviewController.js.map