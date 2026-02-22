/**
 * Payment System Types
 * Types for Stripe payment integration
 */

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum PaymentType {
  SUBSCRIPTION = 'subscription',
  POINTS_PURCHASE = 'points_purchase',
  ONE_TIME = 'one_time'
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  MANUAL = 'manual' // For admin-processed payments
}

// Stripe-specific types
export interface StripeCustomer {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  email: string;
  default_payment_method_id?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface StripePaymentMethod {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  type: 'card' | 'sepa_debit' | 'other';
  card_brand?: string;
  card_last4?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  is_default: boolean;
  created_at: Date;
}

export interface Payment {
  id: string;
  user_id: string;
  stripe_payment_intent_id?: string;
  stripe_invoice_id?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_type: PaymentType;
  payment_provider: PaymentProvider;
  description?: string;
  metadata?: Record<string, any>;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface StripeSubscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  canceled_at?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Request/Response types
export interface CreatePaymentIntentRequest {
  user_id: string;
  amount: number;
  currency?: string;
  payment_type: PaymentType;
  metadata?: Record<string, any>;
}

export interface CreatePaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
}

export interface CreateSubscriptionRequest {
  user_id: string;
  tier_id: string;
  payment_method_id?: string;
}

export interface CreateSubscriptionResponse {
  subscription_id: string;
  client_secret?: string; // For 3D Secure
  status: string;
}

export interface CreateSetupIntentRequest {
  user_id: string;
}

export interface CreateSetupIntentResponse {
  client_secret: string;
  setup_intent_id: string;
}

// Points package for purchase
export interface PointsPackage {
  id: string;
  points: number;
  price: number;
  currency: string;
  discount_percent: number;
  stripe_price_id?: string;
  is_active: boolean;
}

// Webhook event types
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

// Price configuration (matches Stripe products)
export interface StripePriceConfig {
  tier_id: string;
  stripe_price_id: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
}

// Error types
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class StripeError extends PaymentError {
  constructor(
    message: string,
    public stripeCode?: string
  ) {
    super(message, 'STRIPE_ERROR', 400);
    this.name = 'StripeError';
  }
}
