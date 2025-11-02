/**
 * Subscription Service
 * Manages subscription tiers, upgrades, downgrades, and feature access control
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import logger from '../utils/logger';
import {
  SubscriptionTier,
  SubscriptionStatus,
  SubscriptionAction,
  SubscriptionTierData,
  SPSubscription,
  SPSubscriptionHistory,
  SubscriptionUpgradeRequest,
  SubscriptionCancellationRequest,
  FeatureAccessCheck,
  FeatureAccessResult,
  TierBenefits,
  SubscriptionError,
  FeatureLimitError,
  TierRequirementError,
  TierFeatures,
  TierLimits
} from '../types/subscription';

export class SubscriptionService {
  private database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;

  /**
   * Get all available subscription tiers
   */
  async getAllTiers(): Promise<SubscriptionTierData[]> {
    try {
      const query = `
        SELECT * FROM subscription_tiers 
        WHERE is_active = true 
        ORDER BY display_order ASC
      `;
      const rows = await this.database.query(query);
      return rows.map(row => this.mapTierRow(row));
    } catch (error) {
      logger.error('Failed to fetch subscription tiers', { error });
      throw new SubscriptionError('Failed to fetch subscription tiers', 'FETCH_TIERS_ERROR', 500);
    }
  }

  /**
   * Get a specific tier by ID
   */
  async getTierById(tierId: string): Promise<SubscriptionTierData | null> {
    try {
      const query = `SELECT * FROM subscription_tiers WHERE id = $1 AND is_active = true`;
      const rows = await this.database.query(query, [tierId]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return this.mapTierRow(rows[0]);
    } catch (error) {
      logger.error('Failed to fetch tier', { tierId, error });
      throw new SubscriptionError('Failed to fetch tier', 'FETCH_TIER_ERROR', 500);
    }
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<SPSubscription | null> {
    try {
      const query = `
        SELECT * FROM sp_subscriptions 
        WHERE user_id = $1 AND status = $2 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const rows = await this.database.query(query, [userId, SubscriptionStatus.ACTIVE]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return this.mapSubscriptionRow(rows[0]);
    } catch (error) {
      logger.error('Failed to fetch user subscription', { userId, error });
      throw new SubscriptionError('Failed to fetch subscription', 'FETCH_SUBSCRIPTION_ERROR', 500);
    }
  }

  /**
   * Get user's current tier (from users table)
   */
  async getUserTier(userId: string): Promise<SubscriptionTier> {
    try {
      const query = `SELECT subscription_tier_id FROM users WHERE id = $1`;
      const rows = await this.database.query(query, [userId]);
      
      if (rows.length === 0) {
        throw new SubscriptionError('User not found', 'USER_NOT_FOUND', 404);
      }
      
      return (rows[0].subscription_tier_id as SubscriptionTier) || SubscriptionTier.FREE;
    } catch (error) {
      logger.error('Failed to fetch user tier', { userId, error });
      throw error;
    }
  }

  /**
   * Upgrade or change user's subscription tier
   */
  async upgradeSubscription(request: SubscriptionUpgradeRequest): Promise<SPSubscription> {
    const { user_id, target_tier_id, payment_method, auto_renew = false } = request;

    try {
      // Validate target tier exists
      const targetTier = await this.getTierById(target_tier_id);
      if (!targetTier) {
        throw new SubscriptionError('Invalid subscription tier', 'INVALID_TIER', 400);
      }

      // Get current tier
      const currentTierName = await this.getUserTier(user_id);
      const currentTier = await this.getTierById(currentTierName);

      // Determine action type
      let action: SubscriptionAction;
      if (!currentTier || currentTierName === SubscriptionTier.FREE) {
        action = SubscriptionAction.CREATED;
      } else if (targetTier.price_monthly > (currentTier?.price_monthly || 0)) {
        action = SubscriptionAction.UPGRADED;
      } else if (targetTier.price_monthly < (currentTier?.price_monthly || 0)) {
        action = SubscriptionAction.DOWNGRADED;
      } else {
        action = SubscriptionAction.RENEWED;
      }

      // Cancel existing active subscription
      const existingSubscription = await this.getUserSubscription(user_id);
      if (existingSubscription) {
        await this.cancelSubscriptionInternal(existingSubscription.id, user_id);
      }

      // Create new subscription
      const subscriptionId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const insertQuery = `
        INSERT INTO sp_subscriptions (
          id, user_id, tier_id, status, started_at, expires_at, 
          auto_renew, payment_method, next_payment_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const rows = await this.database.query(insertQuery, [
        subscriptionId,
        user_id,
        target_tier_id,
        SubscriptionStatus.ACTIVE,
        now,
        expiresAt,
        auto_renew,
        payment_method || null,
        auto_renew ? expiresAt : null
      ]);

      // Update users table and reset trial status
      await this.database.query(
        `UPDATE users SET 
          subscription_tier_id = $1, 
          subscription_status = $2, 
          subscription_expires_at = $3,
          trial_expired = false
        WHERE id = $4`,
        [target_tier_id, SubscriptionStatus.ACTIVE, expiresAt, user_id]
      );

      // Update service provider profile if PRO or NORMAL
      if (target_tier_id === SubscriptionTier.PRO || target_tier_id === SubscriptionTier.NORMAL) {
        await this.database.query(
          `UPDATE service_provider_profiles SET is_premium = $1, premium_listing_priority = $2 WHERE user_id = $3`,
          [true, target_tier_id === SubscriptionTier.PRO ? 100 : 50, user_id]
        );
      }

      // Record history
      await this.recordSubscriptionHistory({
        subscription_id: subscriptionId,
        user_id,
        tier_id: target_tier_id,
        action,
        previous_tier_id: currentTier?.id,
        amount: targetTier.price_monthly,
        currency: targetTier.currency,
        performed_by: user_id
      });

      logger.info('Subscription upgraded successfully', {
        userId: user_id,
        action,
        fromTier: currentTier?.id,
        toTier: target_tier_id
      });

      return this.mapSubscriptionRow(rows[0]);
    } catch (error) {
      logger.error('Failed to upgrade subscription', { userId: user_id, targetTier: target_tier_id, error });
      throw error;
    }
  }

  /**
   * Cancel user's subscription
   */
  async cancelSubscription(request: SubscriptionCancellationRequest): Promise<void> {
    const { user_id, subscription_id, reason, immediate = false } = request;

    try {
      const subscription = await this.getUserSubscription(user_id);
      if (!subscription || subscription.id !== subscription_id) {
        throw new SubscriptionError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
      }

      await this.cancelSubscriptionInternal(subscription_id, user_id, immediate, reason);

      logger.info('Subscription cancelled', { userId: user_id, subscriptionId: subscription_id, immediate });
    } catch (error) {
      logger.error('Failed to cancel subscription', { userId: user_id, error });
      throw error;
    }
  }

  /**
   * Check if user has access to a feature
   */
  async checkFeatureAccess(check: FeatureAccessCheck): Promise<FeatureAccessResult> {
    const { user_id, feature_key, increment = false } = check;

    try {
      // Get user's tier
      const tierName = await this.getUserTier(user_id);
      const tier = await this.getTierById(tierName);

      if (!tier) {
        throw new SubscriptionError('User tier not found', 'TIER_NOT_FOUND', 404);
      }

      // Check if feature exists in tier
      const featureEnabled = (tier.features as any)[feature_key];
      if (featureEnabled === false || featureEnabled === undefined) {
        return {
          allowed: false,
          current_usage: 0,
          limit: 0,
          tier: tierName,
          message: `Feature '${feature_key}' is not available in your current tier`
        };
      }

      // Check usage limits if applicable
      const limitKey = `max_${feature_key}` as keyof TierLimits;
      const limit = (tier.limits as any)[limitKey];

      if (limit !== undefined && typeof limit === 'number') {
        const usage = await this.getFeatureUsage(user_id, feature_key);
        
        if (usage >= limit) {
          return {
            allowed: false,
            current_usage: usage,
            limit,
            tier: tierName,
            message: `You have reached the limit for '${feature_key}' (${limit})`
          };
        }

        // Increment usage if requested
        if (increment) {
          await this.incrementFeatureUsage(user_id, feature_key);
        }

        return {
          allowed: true,
          current_usage: increment ? usage + 1 : usage,
          limit,
          tier: tierName
        };
      }

      // Feature has no limits
      return {
        allowed: true,
        current_usage: 0,
        limit: -1,
        tier: tierName
      };
    } catch (error) {
      logger.error('Failed to check feature access', { userId: user_id, feature: feature_key, error });
      throw error;
    }
  }

  /**
   * Get tier benefits comparison
   */
  async getTierComparison(): Promise<TierBenefits[]> {
    try {
      const tiers = await this.getAllTiers();
      
      return tiers.map((tier, index) => ({
        tier: tier.id as SubscriptionTier,
        features: tier.features,
        limits: tier.limits,
        price_monthly: tier.price_monthly,
        recommended: tier.id === SubscriptionTier.NORMAL
      }));
    } catch (error) {
      logger.error('Failed to get tier comparison', { error });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async cancelSubscriptionInternal(
    subscriptionId: string,
    userId: string,
    immediate: boolean = false,
    reason?: string
  ): Promise<void> {
    const now = new Date();
    
    if (immediate) {
      // Cancel immediately and downgrade to FREE
      await this.database.query(
        `UPDATE sp_subscriptions SET status = $1, cancelled_at = $2 WHERE id = $3`,
        [SubscriptionStatus.CANCELLED, now, subscriptionId]
      );

      await this.database.query(
        `UPDATE users SET subscription_tier_id = $1, subscription_status = $2 WHERE id = $3`,
        [SubscriptionTier.FREE, SubscriptionStatus.ACTIVE, userId]
      );

      await this.database.query(
        `UPDATE service_provider_profiles SET is_premium = false, premium_listing_priority = 0 WHERE user_id = $1`,
        [userId]
      );
    } else {
      // Cancel at end of period
      await this.database.query(
        `UPDATE sp_subscriptions SET auto_renew = false, cancelled_at = $1 WHERE id = $2`,
        [now, subscriptionId]
      );
    }

    // Record history
    await this.recordSubscriptionHistory({
      subscription_id: subscriptionId,
      user_id: userId,
      tier_id: SubscriptionTier.FREE,
      action: SubscriptionAction.CANCELLED,
      notes: reason,
      performed_by: userId
    });
  }

  private async recordSubscriptionHistory(data: Partial<SPSubscriptionHistory>): Promise<void> {
    const query = `
      INSERT INTO sp_subscription_history (
        id, subscription_id, user_id, tier_id, action, 
        previous_tier_id, amount, currency, notes, performed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    await this.database.query(query, [
      uuidv4(),
      data.subscription_id,
      data.user_id,
      data.tier_id,
      data.action,
      data.previous_tier_id || null,
      data.amount || null,
      data.currency || 'BGN',
      data.notes || null,
      data.performed_by || 'system'
    ]);
  }

  private async getFeatureUsage(userId: string, featureKey: string): Promise<number> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const query = `
      SELECT usage_count FROM sp_feature_usage 
      WHERE user_id = $1 AND feature_key = $2 
        AND period_start = $3 AND period_end = $4
    `;

    const rows = await this.database.query(query, [userId, featureKey, periodStart, periodEnd]);
    return rows.length > 0 ? rows[0].usage_count : 0;
  }

  private async incrementFeatureUsage(userId: string, featureKey: string): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const query = `
      INSERT INTO sp_feature_usage (id, user_id, feature_key, usage_count, period_start, period_end)
      VALUES ($1, $2, $3, 1, $4, $5)
      ON CONFLICT (user_id, feature_key, period_start) 
      DO UPDATE SET usage_count = sp_feature_usage.usage_count + 1, updated_at = CURRENT_TIMESTAMP
    `;

    await this.database.query(query, [uuidv4(), userId, featureKey, periodStart, periodEnd]);
  }

  private mapTierRow(row: any): SubscriptionTierData {
    return {
      id: row.id,
      name: row.name,
      name_bg: row.name_bg,
      description: row.description,
      description_bg: row.description_bg,
      price_monthly: parseFloat(row.price_monthly),
      currency: row.currency,
      features: row.features,
      limits: row.limits,
      is_active: row.is_active,
      display_order: row.display_order,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private mapSubscriptionRow(row: any): SPSubscription {
    return {
      id: row.id,
      user_id: row.user_id,
      tier_id: row.tier_id,
      status: row.status,
      started_at: row.started_at,
      expires_at: row.expires_at,
      cancelled_at: row.cancelled_at,
      auto_renew: row.auto_renew,
      payment_method: row.payment_method,
      last_payment_date: row.last_payment_date,
      next_payment_date: row.next_payment_date,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
