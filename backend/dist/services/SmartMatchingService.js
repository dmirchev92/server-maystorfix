"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartMatchingService = void 0;
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const logger_1 = __importDefault(require("../utils/logger"));
class SmartMatchingService {
    constructor() {
        this.db = DatabaseFactory_1.DatabaseFactory.getDatabase();
    }
    async findBestProviders(caseData, limit = 10) {
        try {
            logger_1.default.info('🎯 Smart Matching - Finding best providers for case', {
                caseId: caseData.id,
                category: caseData.category,
                location: `${caseData.city}, ${caseData.neighborhood}`
            });
            const providers = await this.getEligibleProviders(caseData.category);
            if (providers.length === 0) {
                logger_1.default.warn('⚠️ No eligible providers found for category', { category: caseData.category });
                return [];
            }
            const scoredProviders = [];
            for (const provider of providers) {
                const score = await this.calculateProviderScore(provider, caseData);
                scoredProviders.push(score);
            }
            const topProviders = scoredProviders
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
            logger_1.default.info('✅ Smart Matching - Found top providers', {
                caseId: caseData.id,
                topProvidersCount: topProviders.length,
                topScores: topProviders.slice(0, 3).map(p => ({
                    name: p.provider.business_name,
                    score: p.score.toFixed(2)
                }))
            });
            return topProviders;
        }
        catch (error) {
            logger_1.default.error('❌ Smart Matching - Error finding providers:', error);
            throw error;
        }
    }
    async getEligibleProviders(category) {
        return new Promise((resolve, reject) => {
            this.db.db.all(`SELECT sp.*, u.first_name, u.last_name, u.email, u.phone_number,
                COALESCE(avg_rating.rating, 0) as rating,
                COALESCE(avg_rating.total_reviews, 0) as total_reviews,
                CASE WHEN u.last_login > datetime('now', '-24 hours') THEN 1 ELSE 0 END as is_available
         FROM service_providers sp
         JOIN users u ON sp.user_id = u.id
         LEFT JOIN (
           SELECT provider_id, 
                  AVG(rating) as rating, 
                  COUNT(*) as total_reviews
           FROM case_reviews 
           GROUP BY provider_id
         ) avg_rating ON sp.user_id = avg_rating.provider_id
         WHERE sp.service_category = ? 
           AND u.status = 'active'
           AND sp.is_verified = 1
         ORDER BY u.last_login DESC`, [category], (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows || []);
                }
            });
        });
    }
    async calculateProviderScore(provider, caseData) {
        const factors = {
            categoryMatch: this.calculateCategoryMatch(provider, caseData),
            locationMatch: this.calculateLocationMatch(provider, caseData),
            ratingScore: this.calculateRatingScore(provider),
            availabilityScore: this.calculateAvailabilityScore(provider),
            experienceScore: this.calculateExperienceScore(provider),
            priceScore: this.calculatePriceScore(provider, caseData),
            responseTimeScore: await this.calculateResponseTimeScore(provider.id)
        };
        const weights = {
            categoryMatch: 0.25,
            locationMatch: 0.20,
            ratingScore: 0.20,
            availabilityScore: 0.15,
            experienceScore: 0.10,
            priceScore: 0.05,
            responseTimeScore: 0.05
        };
        const totalScore = Object.entries(factors).reduce((sum, [key, value]) => {
            return sum + (value * weights[key]);
        }, 0);
        return {
            provider,
            score: Math.round(totalScore * 100) / 100,
            factors
        };
    }
    calculateCategoryMatch(provider, caseData) {
        if (provider.service_category === caseData.category) {
            return 100;
        }
        const relatedCategories = {
            'electrician': ['handyman'],
            'plumber': ['handyman'],
            'hvac': ['handyman'],
            'handyman': ['electrician', 'plumber', 'hvac', 'carpenter', 'painter']
        };
        const related = relatedCategories[caseData.category] || [];
        if (related.includes(provider.service_category)) {
            return 60;
        }
        return 0;
    }
    calculateLocationMatch(provider, caseData) {
        if (!caseData.city || !provider.city) {
            return 50;
        }
        if (provider.city === caseData.city && provider.neighborhood === caseData.neighborhood) {
            return 100;
        }
        if (provider.city === caseData.city) {
            return 80;
        }
        return 30;
    }
    calculateRatingScore(provider) {
        if (provider.total_reviews === 0) {
            return 50;
        }
        const baseScore = (provider.rating / 5) * 100;
        const reviewBoost = Math.min(provider.total_reviews * 2, 20);
        return Math.min(baseScore + reviewBoost, 100);
    }
    calculateAvailabilityScore(provider) {
        if (provider.is_available) {
            return 100;
        }
        return 60;
    }
    calculateExperienceScore(provider) {
        const years = provider.experience_years || 0;
        if (years >= 10)
            return 100;
        if (years >= 5)
            return 80;
        if (years >= 2)
            return 60;
        if (years >= 1)
            return 40;
        return 20;
    }
    calculatePriceScore(provider, caseData) {
        const rate = provider.hourly_rate || 0;
        if (rate === 0)
            return 50;
        if (rate <= 30)
            return 100;
        if (rate <= 50)
            return 80;
        if (rate <= 80)
            return 60;
        return 40;
    }
    async calculateResponseTimeScore(providerId) {
        try {
            const avgResponseTime = await new Promise((resolve) => {
                this.db.db.get(`SELECT AVG(
             CAST((julianday(accepted_at) - julianday(created_at)) * 24 * 60 AS INTEGER)
           ) as avg_minutes
           FROM marketplace_service_cases 
           WHERE provider_id = ? 
             AND accepted_at IS NOT NULL 
             AND created_at > datetime('now', '-30 days')`, [providerId], (err, row) => {
                    if (err || !row?.avg_minutes) {
                        resolve(60);
                    }
                    else {
                        resolve(row.avg_minutes);
                    }
                });
            });
            if (avgResponseTime <= 30)
                return 100;
            if (avgResponseTime <= 120)
                return 80;
            if (avgResponseTime <= 480)
                return 60;
            if (avgResponseTime <= 1440)
                return 40;
            return 20;
        }
        catch (error) {
            logger_1.default.error('Error calculating response time score:', error);
            return 50;
        }
    }
    async autoAssignCase(caseId) {
        try {
            const caseData = await new Promise((resolve, reject) => {
                this.db.db.get('SELECT * FROM marketplace_service_cases WHERE id = ?', [caseId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });
            });
            if (!caseData) {
                throw new Error('Case not found');
            }
            const topProviders = await this.findBestProviders(caseData, 1);
            if (topProviders.length === 0) {
                logger_1.default.warn('No suitable providers found for auto-assignment', { caseId });
                return null;
            }
            const bestProvider = topProviders[0];
            await new Promise((resolve, reject) => {
                this.db.db.run(`UPDATE marketplace_service_cases 
           SET status = 'wip', 
               provider_id = ?, 
               provider_name = ?,
               auto_assigned = 1,
               updated_at = datetime('now')
           WHERE id = ?`, [
                    bestProvider.provider.id,
                    bestProvider.provider.business_name,
                    caseId
                ], function (err) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('✅ Case auto-assigned successfully', {
                caseId,
                providerId: bestProvider.provider.id,
                providerName: bestProvider.provider.business_name,
                score: bestProvider.score
            });
            return bestProvider.provider.id;
        }
        catch (error) {
            logger_1.default.error('❌ Error auto-assigning case:', error);
            throw error;
        }
    }
}
exports.SmartMatchingService = SmartMatchingService;
exports.default = SmartMatchingService;
//# sourceMappingURL=SmartMatchingService.js.map