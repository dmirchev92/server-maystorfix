/**
 * Payment Service
 * Handles payment-related API calls and Stripe integration
 * 
 * IMPORTANT: Payment functionality is prepared but NOT ACTIVE until:
 * 1. Stripe is configured on the backend
 * 2. @stripe/stripe-react-native is installed
 * 
 * To enable:
 * 1. npm install @stripe/stripe-react-native
 * 2. Follow Stripe React Native setup guide for iOS/Android
 * 3. Set STRIPE_PUBLISHABLE_KEY in environment
 */

import ApiService from './ApiService';

// Types
export interface PointsPackage {
  id: string;
  points: number;
  price: number;
  currency: string;
  discount_percent: number;
  stripe_price_id?: string;
  is_active: boolean;
}

export interface SubscriptionPrice {
  yearly: number;
  currency: string;
}

export interface PaymentStatus {
  enabled: boolean;
  provider: string;
  message: string;
}

export interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
}

export interface SetupIntentResponse {
  client_secret: string;
  setup_intent_id: string;
}

export interface SubscriptionResponse {
  subscription_id: string;
  client_secret?: string;
  status: string;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  description?: string;
  created_at: string;
}

class PaymentService {
  private static instance: PaymentService;
  private apiService: ApiService;

  private constructor() {
    this.apiService = ApiService.getInstance();
  }

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Check if payment system is available
   */
  async getPaymentStatus(): Promise<{ success: boolean; data?: PaymentStatus; error?: any }> {
    return this.apiService.get<PaymentStatus>('/payments/status');
  }

  /**
   * Get available points packages
   */
  async getPointsPackages(): Promise<{ success: boolean; data?: { packages: PointsPackage[]; payment_enabled: boolean }; error?: any }> {
    return this.apiService.get<{ packages: PointsPackage[]; payment_enabled: boolean }>('/payments/points-packages');
  }

  /**
   * Get subscription prices
   */
  async getSubscriptionPrices(): Promise<{ success: boolean; data?: { prices: Record<string, SubscriptionPrice>; payment_enabled: boolean }; error?: any }> {
    return this.apiService.get<{ prices: Record<string, SubscriptionPrice>; payment_enabled: boolean }>('/payments/subscription-prices');
  }

  /**
   * Create payment intent for points purchase
   */
  async createPaymentIntent(pointsPackageId: string): Promise<{ success: boolean; data?: PaymentIntentResponse; error?: any }> {
    return this.apiService.post<PaymentIntentResponse>('/payments/create-payment-intent', { points_package_id: pointsPackageId });
  }

  /**
   * Create setup intent (save card)
   */
  async createSetupIntent(): Promise<{ success: boolean; data?: SetupIntentResponse; error?: any }> {
    return this.apiService.post<SetupIntentResponse>('/payments/create-setup-intent', {});
  }

  /**
   * Create subscription
   */
  async createSubscription(tierId: string, paymentMethodId?: string): Promise<{ success: boolean; data?: SubscriptionResponse; error?: any }> {
    return this.apiService.post<SubscriptionResponse>('/payments/create-subscription', { tier_id: tierId, payment_method_id: paymentMethodId });
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(immediate: boolean = false): Promise<{ success: boolean; data?: { message: string }; error?: any }> {
    return this.apiService.post<{ message: string }>('/payments/cancel-subscription', { immediate });
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(): Promise<{ success: boolean; data?: { payments: Payment[] }; error?: any }> {
    return this.apiService.get<{ payments: Payment[] }>('/payments/history');
  }
}

export default PaymentService;
