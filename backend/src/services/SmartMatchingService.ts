// @ts-nocheck
import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';

interface Provider {
  id: string;
  business_name: string;
  service_category: string;
  city: string;
  neighborhood: string;
  rating: number;
  total_reviews: number;
  experience_years: number;
  hourly_rate: number;
  phone_number: string;
  email: string;
  first_name: string;
  last_name: string;
  is_available: boolean;
  last_active: string;
}

interface Case {
  id: string;
  service_type: string;
  category: string;
  city?: string;
  neighborhood?: string;
  priority: string;
  preferred_date?: string;
  created_at: string;
}

interface ProviderScore {
  provider: Provider;
  score: number;
  factors: {
    categoryMatch: number;
    locationMatch: number;
    ratingScore: number;
    availabilityScore: number;
    experienceScore: number;
    priceScore: number;
    responseTimeScore: number;
  };
}

export class SmartMatchingService {
  private db: any; // DatabaseFactory returns SQLiteDatabase | PostgreSQLDatabase

  constructor() {
    this.db = DatabaseFactory.getDatabase();
  }

  /**
   * Find and rank the best providers for a case
   */
  async findBestProviders(caseData: Case, limit: number = 10): Promise<ProviderScore[]> {
    try {
      logger.info('🎯 Smart Matching - Finding best providers for case', { 
        caseId: caseData.id, 
        category: caseData.category,
        location: `${caseData.city}, ${caseData.neighborhood}`
      });

      // Get all active providers for the category
      const providers = await this.getEligibleProviders(caseData.category);
      
      if (providers.length === 0) {
        logger.warn('⚠️ No eligible providers found for category', { category: caseData.category });
        return [];
      }

      // Score each provider
      const scoredProviders: ProviderScore[] = [];
      
      for (const provider of providers) {
        const score = await this.calculateProviderScore(provider, caseData);
        scoredProviders.push(score);
      }

      // Sort by score (highest first) and return top matches
      const topProviders = scoredProviders
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      logger.info('✅ Smart Matching - Found top providers', { 
        caseId: caseData.id,
        topProvidersCount: topProviders.length,
        topScores: topProviders.slice(0, 3).map(p => ({ 
          name: p.provider.business_name, 
          score: p.score.toFixed(2) 
        }))
      });

      return topProviders;

    } catch (error) {
      logger.error('❌ Smart Matching - Error finding providers:', error);
      throw error;
    }
  }

  /**
   * Find active PRO providers nearby for instant alert
   */
  async findNearbyProProviders(
    category: string, 
    latitude: number, 
    longitude: number, 
    radiusKm: number = 5
  ): Promise<Provider[]> {
    if (DatabaseFactory.isPostgreSQL()) {
      try {
        // PostgreSQL implementation using Haversine formula
        const result = await this.db.query(
          `SELECT sp.*, u.first_name, u.last_name, u.email, u.phone_number,
                  (6371 * acos(cos(radians($1)) * cos(radians(sp.latitude)) * cos(radians(sp.longitude) - radians($2)) + sin(radians($3)) * sin(radians(sp.latitude)))) AS distance
           FROM service_provider_profiles sp
           JOIN users u ON sp.user_id = u.id
           WHERE (sp.service_category = $4 OR sp.service_category = REPLACE($4, 'cat_', ''))
             AND u.status = 'active'
             AND u.subscription_tier_id = 'pro'
             -- AND sp.is_verified = true -- Relaxed for testing
             AND sp.latitude IS NOT NULL
             AND sp.longitude IS NOT NULL
             AND (6371 * acos(cos(radians($1)) * cos(radians(sp.latitude)) * cos(radians(sp.longitude) - radians($2)) + sin(radians($3)) * sin(radians(sp.latitude)))) < $5
           ORDER BY distance ASC`,
          [latitude, longitude, latitude, category, radiusKm]
        );
        
        // Map to Provider interface
        return result.map((row: any) => ({
          id: row.user_id, // Use user_id as provider ID
          business_name: row.business_name,
          service_category: row.service_category,
          city: row.city,
          neighborhood: row.neighborhood,
          rating: 0, // Default
          total_reviews: 0, // Default
          experience_years: row.experience_years || 0,
          hourly_rate: row.hourly_rate || 0,
          phone_number: row.phone_number,
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
          is_available: true, // Assumed active
          last_active: new Date().toISOString(),
          distance: row.distance
        }));
      } catch (error) {
        logger.error('Error finding nearby PRO providers:', error);
        return [];
      }
    } else {
      // SQLite fallback (simplified)
      return [];
    }
  }

  /**
   * Get providers eligible for a specific category
   */
  private async getEligibleProviders(category: string): Promise<Provider[]> {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        `SELECT sp.*, u.first_name, u.last_name, u.email, u.phone_number,
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
         ORDER BY u.last_login DESC`,
        [category],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Calculate comprehensive score for a provider
   */
  private async calculateProviderScore(provider: Provider, caseData: Case): Promise<ProviderScore> {
    const factors = {
      categoryMatch: this.calculateCategoryMatch(provider, caseData),
      locationMatch: this.calculateLocationMatch(provider, caseData),
      ratingScore: this.calculateRatingScore(provider),
      availabilityScore: this.calculateAvailabilityScore(provider),
      experienceScore: this.calculateExperienceScore(provider),
      priceScore: this.calculatePriceScore(provider, caseData),
      responseTimeScore: await this.calculateResponseTimeScore(provider.id)
    };

    // Weighted scoring system
    const weights = {
      categoryMatch: 0.25,    // 25% - Must match service category
      locationMatch: 0.20,    // 20% - Proximity is important
      ratingScore: 0.20,      // 20% - Quality matters
      availabilityScore: 0.15, // 15% - Availability is key
      experienceScore: 0.10,   // 10% - Experience helps
      priceScore: 0.05,        // 5% - Price consideration
      responseTimeScore: 0.05  // 5% - Response speed
    };

    const totalScore = Object.entries(factors).reduce((sum, [key, value]) => {
      return sum + (value * weights[key as keyof typeof weights]);
    }, 0);

    return {
      provider,
      score: Math.round(totalScore * 100) / 100, // Round to 2 decimal places
      factors
    };
  }

  /**
   * Category matching score (0-100)
   */
  private calculateCategoryMatch(provider: Provider, caseData: Case): number {
    // Normalize categories by stripping cat_ prefix for comparison
    const normalizedCaseCategory = caseData.category.replace('cat_', '');
    const normalizedProviderCategory = provider.service_category.replace('cat_', '');
    
    if (normalizedProviderCategory === normalizedCaseCategory) {
      return 100;
    }
    
    // Check for related categories
    const relatedCategories: { [key: string]: string[] } = {
      'electrician': ['handyman'],
      'plumber': ['handyman'],
      'hvac': ['handyman'],
      'handyman': ['electrician', 'plumber', 'hvac', 'carpenter', 'painter']
    };

    const related = relatedCategories[normalizedCaseCategory] || [];
    if (related.includes(normalizedProviderCategory)) {
      return 60; // Partial match for related services
    }

    return 0; // No match
  }

  /**
   * Location proximity score (0-100)
   */
  private calculateLocationMatch(provider: Provider, caseData: Case): number {
    if (!caseData.city || !provider.city) {
      return 50; // Neutral score if location data missing
    }

    // Exact city and neighborhood match
    if (provider.city === caseData.city && provider.neighborhood === caseData.neighborhood) {
      return 100;
    }

    // Same city, different neighborhood
    if (provider.city === caseData.city) {
      return 80;
    }

    // Different city - could implement distance calculation here
    return 30;
  }

  /**
   * Rating-based score (0-100)
   */
  private calculateRatingScore(provider: Provider): number {
    if (provider.total_reviews === 0) {
      return 50; // Neutral score for new providers
    }

    // Convert 5-star rating to 100-point scale
    const baseScore = (provider.rating / 5) * 100;
    
    // Boost score based on number of reviews (more reviews = more reliable)
    const reviewBoost = Math.min(provider.total_reviews * 2, 20); // Max 20 point boost
    
    return Math.min(baseScore + reviewBoost, 100);
  }

  /**
   * Availability score based on recent activity (0-100)
   */
  private calculateAvailabilityScore(provider: Provider): number {
    if (provider.is_available) {
      return 100; // Recently active
    }

    // Could check calendar availability, current workload, etc.
    return 60; // Default for inactive providers
  }

  /**
   * Experience score (0-100)
   */
  private calculateExperienceScore(provider: Provider): number {
    const years = provider.experience_years || 0;
    
    if (years >= 10) return 100;
    if (years >= 5) return 80;
    if (years >= 2) return 60;
    if (years >= 1) return 40;
    
    return 20; // New providers
  }

  /**
   * Price competitiveness score (0-100)
   */
  private calculatePriceScore(provider: Provider, caseData: Case): number {
    // For now, return neutral score
    // Could implement market rate comparison here
    const rate = provider.hourly_rate || 0;
    
    if (rate === 0) return 50; // No rate specified
    
    // Simple scoring - lower rates get higher scores
    // This would need market data for proper implementation
    if (rate <= 30) return 100;
    if (rate <= 50) return 80;
    if (rate <= 80) return 60;
    
    return 40;
  }

  /**
   * Response time score based on historical data (0-100)
   */
  private async calculateResponseTimeScore(providerId: string): Promise<number> {
    try {
      const avgResponseTime = await new Promise<number>((resolve) => {
        this.db.db.get(
          `SELECT AVG(
             CAST((julianday(accepted_at) - julianday(created_at)) * 24 * 60 AS INTEGER)
           ) as avg_minutes
           FROM marketplace_service_cases 
           WHERE provider_id = ? 
             AND accepted_at IS NOT NULL 
             AND created_at > datetime('now', '-30 days')`,
          [providerId],
          (err, row: any) => {
            if (err || !row?.avg_minutes) {
              resolve(60); // Default neutral score
            } else {
              resolve(row.avg_minutes);
            }
          }
        );
      });

      // Score based on average response time
      if (avgResponseTime <= 30) return 100;  // Within 30 minutes
      if (avgResponseTime <= 120) return 80;  // Within 2 hours
      if (avgResponseTime <= 480) return 60;  // Within 8 hours
      if (avgResponseTime <= 1440) return 40; // Within 24 hours
      
      return 20; // Slower than 24 hours

    } catch (error) {
      logger.error('Error calculating response time score:', error);
      return 50; // Default score on error
    }
  }

  /**
   * Auto-assign case to best provider (optional feature)
   */
  async autoAssignCase(caseId: string): Promise<string | null> {
    try {
      // Get case details
      const caseData = await new Promise<Case>((resolve, reject) => {
        this.db.db.get(
          'SELECT * FROM marketplace_service_cases WHERE id = ?',
          [caseId],
          (err, row: any) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!caseData) {
        throw new Error('Case not found');
      }

      // Find best providers
      const topProviders = await this.findBestProviders(caseData, 1);
      
      if (topProviders.length === 0) {
        logger.warn('No suitable providers found for auto-assignment', { caseId });
        return null;
      }

      const bestProvider = topProviders[0];
      
      // Auto-assign to best provider
      await new Promise<void>((resolve, reject) => {
        this.db.db.run(
          `UPDATE marketplace_service_cases 
           SET status = 'wip', 
               provider_id = ?, 
               provider_name = ?,
               auto_assigned = 1,
               updated_at = datetime('now')
           WHERE id = ?`,
          [
            bestProvider.provider.id,
            bestProvider.provider.business_name,
            caseId
          ],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      logger.info('✅ Case auto-assigned successfully', {
        caseId,
        providerId: bestProvider.provider.id,
        providerName: bestProvider.provider.business_name,
        score: bestProvider.score
      });

      return bestProvider.provider.id;

    } catch (error) {
      logger.error('❌ Error auto-assigning case:', error);
      throw error;
    }
  }
}

export default SmartMatchingService;
