/**
 * Subscription Tiers System Types
 * Defines types for 3-tier subscription system (FREE, NORMAL, PRO)
 */

export enum SubscriptionTier {
  FREE = 'free',
  NORMAL = 'normal',
  PRO = 'pro'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PENDING = 'pending'
}

export enum SubscriptionAction {
  CREATED = 'created',
  UPGRADED = 'upgraded',
  DOWNGRADED = 'downgraded',
  RENEWED = 'renewed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export enum PremiumBidStatus {
  ACTIVE = 'active',
  OUTBID = 'outbid',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface TierFeatures {
  profile_listing: boolean;
  basic_search_visibility?: boolean;
  enhanced_search_visibility?: boolean;
  premium_search_visibility?: boolean;
  customer_reviews: boolean;
  case_notifications: boolean;
  chat_messaging: boolean;
  photo_gallery: boolean;
  video_gallery?: boolean;
  basic_analytics?: boolean;
  advanced_analytics?: boolean;
  priority_notifications?: boolean;
  verified_badge?: boolean;
  premium_badge?: boolean;
  social_media_links?: boolean;
  business_hours?: boolean;
  featured_listing?: boolean;
  bidding_system?: boolean;
  priority_support?: boolean;
  custom_branding?: boolean;
  api_access?: boolean;
  lead_generation?: boolean;
}

export interface TierLimits {
  max_service_categories: number;
  max_gallery_photos: number;
  max_certificates: number;
  monthly_case_responses: number;
  monthly_sms_limit: number;
  search_ranking: 'standard' | 'enhanced' | 'premium';
  analytics_access: boolean;
  priority_support: boolean;
  featured_listing: boolean;
  premium_badge: boolean;
  bidding_enabled?: boolean;
  max_active_bids?: number;
  // Points system for case access - Granular budget ranges
  points_monthly: number;
  max_case_budget: number;
  points_cost_1_250: number;      // 1-250 BGN
  points_cost_250_500: number;    // 250-500 BGN
  points_cost_500_750: number;    // 500-750 BGN
  points_cost_750_1000: number;   // 750-1000 BGN
  points_cost_1000_1500: number;  // 1000-1500 BGN
  points_cost_1500_2000: number;  // 1500-2000 BGN
  points_cost_2000_3000: number;  // 2000-3000 BGN
  points_cost_3000_4000: number;  // 3000-4000 BGN
  points_cost_4000_5000: number;  // 4000-5000 BGN
}

export interface SubscriptionTierData {
  id: string;
  name: string;
  name_bg: string;
  description: string;
  description_bg: string;
  price_monthly: number;
  currency: string;
  features: TierFeatures;
  limits: TierLimits;
  is_active: boolean;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface SPSubscription {
  id: string;
  user_id: string;
  tier_id: string;
  status: SubscriptionStatus;
  started_at: Date;
  expires_at?: Date;
  cancelled_at?: Date;
  auto_renew: boolean;
  payment_method?: string;
  last_payment_date?: Date;
  next_payment_date?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface SPSubscriptionHistory {
  id: string;
  subscription_id: string;
  user_id: string;
  tier_id: string;
  action: SubscriptionAction;
  previous_tier_id?: string;
  amount?: number;
  currency?: string;
  notes?: string;
  performed_by: string;
  created_at: Date;
}

export interface SPPremiumBid {
  id: string;
  user_id: string;
  service_category: string;
  city: string;
  neighborhood?: string;
  bid_amount: number;
  currency: string;
  status: PremiumBidStatus;
  priority_score: number;
  started_at: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SPFeatureUsage {
  id: string;
  user_id: string;
  feature_key: string;
  usage_count: number;
  period_start: Date;
  period_end: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface SPSMSPackage {
  id: string;
  user_id: string;
  package_type: string;
  sms_count: number;
  price: number;
  currency: string;
  purchased_at: Date;
  expires_at?: Date;
  sms_used: number;
  sms_remaining: number;
  status: 'active' | 'expired' | 'depleted';
  payment_method?: string;
  payment_reference?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface TierComparisonItem {
  feature: string;
  feature_bg: string;
  free: boolean | string | number;
  normal: boolean | string | number;
  pro: boolean | string | number;
}

export interface SubscriptionUpgradeRequest {
  user_id: string;
  target_tier_id: string;
  payment_method?: string;
  auto_renew?: boolean;
}

export interface SubscriptionCancellationRequest {
  user_id: string;
  subscription_id: string;
  reason?: string;
  immediate?: boolean;
}

export interface PremiumBidRequest {
  user_id: string;
  service_category: string;
  city: string;
  neighborhood?: string;
  bid_amount: number;
  duration_days?: number;
}

export interface FeatureAccessCheck {
  user_id: string;
  feature_key: string;
  increment?: boolean;
}

export interface FeatureAccessResult {
  allowed: boolean;
  current_usage: number;
  limit: number;
  tier: SubscriptionTier;
  message?: string;
}

export interface TierBenefits {
  tier: SubscriptionTier;
  features: TierFeatures;
  limits: TierLimits;
  price_monthly: number;
  savings?: number;
  recommended?: boolean;
}

// Error types
export class SubscriptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export class FeatureLimitError extends SubscriptionError {
  constructor(
    message: string,
    public feature: string,
    public currentUsage: number,
    public limit: number
  ) {
    super(message, 'FEATURE_LIMIT_EXCEEDED', 403);
    this.name = 'FeatureLimitError';
  }
}

export class TierRequirementError extends SubscriptionError {
  constructor(
    message: string,
    public requiredTier: SubscriptionTier,
    public currentTier: SubscriptionTier
  ) {
    super(message, 'TIER_REQUIREMENT_NOT_MET', 403);
    this.name = 'TierRequirementError';
  }
}

// Points System Types
export interface SPPointsTransaction {
  id: string;
  user_id: string;
  transaction_type: 'earned' | 'spent' | 'refund' | 'reset' | 'bonus';
  points_amount: number;
  balance_after: number;
  reason: string;
  case_id?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface SPCaseAccess {
  id: string;
  user_id: string;
  case_id: string;
  points_spent: number;
  case_budget: number;
  accessed_at: Date;
}

export interface PointsBalance {
  current_balance: number;
  total_earned: number;
  total_spent: number;
  last_reset?: Date;
  monthly_allowance: number;
}

export interface CaseAccessRequest {
  user_id: string;
  case_id: string;
  case_budget: number;
}

export interface CaseAccessResult {
  allowed: boolean;
  points_required: number;
  points_balance: number;
  message?: string;
  case_budget_range?: string;
}
