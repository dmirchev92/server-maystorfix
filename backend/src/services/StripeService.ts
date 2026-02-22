/**
 * Stripe Payment Service
 * Handles all Stripe payment operations
 * 
 * IMPORTANT: This service is prepared but NOT ACTIVE until:
 * 1. You have a registered company
 * 2. You have a Stripe account with API keys
 * 3. You set STRIPE_ENABLED=true in .env
 * 
 * Current state: All methods return mock responses or throw "not enabled" errors
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import logger from '../utils/logger';
import {
  PaymentStatus,
  PaymentType,
  PaymentProvider,
  Payment,
  StripeCustomer,
  StripeSubscription,
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  CreateSetupIntentRequest,
  CreateSetupIntentResponse,
  PointsPackage,
  PaymentError,
  StripeError
} from '../types/payment';
import { SubscriptionService } from './SubscriptionService';

// Stripe SDK - will be imported when enabled
// import Stripe from 'stripe';

// Price IDs - Configure these in Stripe Dashboard when ready
const STRIPE_PRICE_IDS = {
  // Subscription tiers (yearly)
  subscription_normal_yearly: process.env.STRIPE_PRICE_NORMAL_YEARLY || 'price_normal_yearly_placeholder',
  subscription_pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly_placeholder',
  
  // Points packages
  points_50: process.env.STRIPE_PRICE_POINTS_50 || 'price_points_50_placeholder',
  points_100: process.env.STRIPE_PRICE_POINTS_100 || 'price_points_100_placeholder',
  points_200: process.env.STRIPE_PRICE_POINTS_200 || 'price_points_200_placeholder',
  points_500: process.env.STRIPE_PRICE_POINTS_500 || 'price_points_500_placeholder',
};

// Points packages configuration
const POINTS_PACKAGES: PointsPackage[] = [
  { id: 'points_50', points: 50, price: 7.50, currency: 'EUR', discount_percent: 0, stripe_price_id: STRIPE_PRICE_IDS.points_50, is_active: true },
  { id: 'points_100', points: 100, price: 14.00, currency: 'EUR', discount_percent: 7, stripe_price_id: STRIPE_PRICE_IDS.points_100, is_active: true },
  { id: 'points_200', points: 200, price: 26.00, currency: 'EUR', discount_percent: 13, stripe_price_id: STRIPE_PRICE_IDS.points_200, is_active: true },
  { id: 'points_500', points: 500, price: 60.00, currency: 'EUR', discount_percent: 20, stripe_price_id: STRIPE_PRICE_IDS.points_500, is_active: true },
];

// Subscription prices (EUR)
const SUBSCRIPTION_PRICES = {
  normal: { yearly: 179, currency: 'EUR' },
  pro: { yearly: 249, currency: 'EUR' },
};

export class StripeService {
  private database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;
  private stripe: any = null; // Will be Stripe instance when enabled
  private isEnabled: boolean = false;

  constructor() {
    this.initializeStripe();
  }

  /**
   * Initialize Stripe SDK if enabled
   */
  private initializeStripe(): void {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const stripeEnabled = process.env.STRIPE_ENABLED === 'true';

    if (stripeEnabled && stripeSecretKey) {
      try {
        // Uncomment when ready to use Stripe:
        // const Stripe = require('stripe');
        // this.stripe = new Stripe(stripeSecretKey, {
        //   apiVersion: '2023-10-16',
        //   typescript: true,
        // });
        // this.isEnabled = true;
        
        logger.info('Stripe service initialized (placeholder mode)');
      } catch (error) {
        logger.error('Failed to initialize Stripe', { error });
        this.isEnabled = false;
      }
    } else {
      logger.info('Stripe service disabled - missing configuration');
      this.isEnabled = false;
    }
  }

  /**
   * Check if Stripe is enabled
   */
  isStripeEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Ensure Stripe is enabled before operations
   */
  private ensureEnabled(): void {
    if (!this.isEnabled) {
      throw new PaymentError(
        'Payment processing is not yet available. Please contact support.',
        'STRIPE_NOT_ENABLED',
        503
      );
    }
  }

  // ============================================================================
  // CUSTOMER MANAGEMENT
  // ============================================================================

  /**
   * Get or create Stripe customer for user
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<StripeCustomer> {
    // Check if customer exists in our database
    const existingCustomer = await this.getCustomerByUserId(userId);
    if (existingCustomer) {
      return existingCustomer;
    }

    // If Stripe is not enabled, create a placeholder customer record
    if (!this.isEnabled) {
      return this.createPlaceholderCustomer(userId, email);
    }

    // Create customer in Stripe
    // const stripeCustomer = await this.stripe.customers.create({
    //   email,
    //   metadata: { user_id: userId }
    // });

    // For now, create placeholder
    return this.createPlaceholderCustomer(userId, email);
  }

  /**
   * Get customer by user ID
   */
  async getCustomerByUserId(userId: string): Promise<StripeCustomer | null> {
    try {
      const query = `SELECT * FROM stripe_customers WHERE user_id = $1`;
      const rows = await this.database.query(query, [userId]);
      
      if (rows.length === 0) {
        return null;
      }

      return this.mapCustomerRow(rows[0]);
    } catch (error) {
      // Table might not exist yet
      logger.debug('stripe_customers table not found or error', { error });
      return null;
    }
  }

  /**
   * Create placeholder customer (before Stripe is enabled)
   */
  private async createPlaceholderCustomer(userId: string, email: string): Promise<StripeCustomer> {
    const customerId = uuidv4();
    const placeholderStripeId = `cus_placeholder_${userId.substring(0, 8)}`;

    try {
      const query = `
        INSERT INTO stripe_customers (id, user_id, stripe_customer_id, email)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET email = $4, updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const rows = await this.database.query(query, [customerId, userId, placeholderStripeId, email]);
      return this.mapCustomerRow(rows[0]);
    } catch (error) {
      // If table doesn't exist, return mock object
      logger.debug('Could not save customer, returning mock', { error });
      return {
        id: customerId,
        user_id: userId,
        stripe_customer_id: placeholderStripeId,
        email,
        created_at: new Date(),
        updated_at: new Date()
      };
    }
  }

  // ============================================================================
  // PAYMENT INTENTS (One-time payments like points purchase)
  // ============================================================================

  /**
   * Create a payment intent for one-time purchase (e.g., points)
   */
  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    this.ensureEnabled();

    const { user_id, amount, currency = 'EUR', payment_type, metadata = {} } = request;

    // Get or create customer
    const userEmail = await this.getUserEmail(user_id);
    const customer = await this.getOrCreateCustomer(user_id, userEmail);

    // Create payment intent in Stripe
    // const paymentIntent = await this.stripe.paymentIntents.create({
    //   amount: Math.round(amount * 100), // Stripe uses cents
    //   currency: currency.toLowerCase(),
    //   customer: customer.stripe_customer_id,
    //   metadata: {
    //     user_id,
    //     payment_type,
    //     ...metadata
    //   },
    //   automatic_payment_methods: { enabled: true }
    // });

    // Record payment in our database
    const paymentId = uuidv4();
    await this.recordPayment({
      id: paymentId,
      user_id,
      stripe_payment_intent_id: 'pi_placeholder', // paymentIntent.id
      amount,
      currency,
      status: PaymentStatus.PENDING,
      payment_type,
      payment_provider: PaymentProvider.STRIPE,
      metadata
    });

    return {
      client_secret: 'placeholder_client_secret', // paymentIntent.client_secret
      payment_intent_id: 'pi_placeholder', // paymentIntent.id
      amount,
      currency
    };
  }

  /**
   * Create setup intent (to save card without charging)
   */
  async createSetupIntent(request: CreateSetupIntentRequest): Promise<CreateSetupIntentResponse> {
    this.ensureEnabled();

    const { user_id } = request;

    // Get or create customer
    const userEmail = await this.getUserEmail(user_id);
    const customer = await this.getOrCreateCustomer(user_id, userEmail);

    // Create setup intent in Stripe
    // const setupIntent = await this.stripe.setupIntents.create({
    //   customer: customer.stripe_customer_id,
    //   payment_method_types: ['card'],
    //   metadata: { user_id }
    // });

    return {
      client_secret: 'placeholder_setup_secret', // setupIntent.client_secret
      setup_intent_id: 'seti_placeholder' // setupIntent.id
    };
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  /**
   * Create a subscription for a user
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> {
    this.ensureEnabled();

    const { user_id, tier_id, payment_method_id } = request;

    // Validate tier
    if (!['normal', 'pro'].includes(tier_id)) {
      throw new PaymentError('Invalid subscription tier', 'INVALID_TIER', 400);
    }

    // Get price ID for tier
    const priceId = tier_id === 'normal' 
      ? STRIPE_PRICE_IDS.subscription_normal_yearly 
      : STRIPE_PRICE_IDS.subscription_pro_yearly;

    // Get or create customer
    const userEmail = await this.getUserEmail(user_id);
    const customer = await this.getOrCreateCustomer(user_id, userEmail);

    // Create subscription in Stripe
    // const subscription = await this.stripe.subscriptions.create({
    //   customer: customer.stripe_customer_id,
    //   items: [{ price: priceId }],
    //   payment_behavior: 'default_incomplete',
    //   payment_settings: { save_default_payment_method: 'on_subscription' },
    //   expand: ['latest_invoice.payment_intent'],
    //   metadata: { user_id, tier_id }
    // });

    // Record subscription in our database
    const subscriptionId = uuidv4();
    await this.recordStripeSubscription({
      id: subscriptionId,
      user_id,
      stripe_subscription_id: 'sub_placeholder', // subscription.id
      stripe_customer_id: customer.stripe_customer_id,
      stripe_price_id: priceId,
      status: 'incomplete',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });

    return {
      subscription_id: subscriptionId,
      client_secret: 'placeholder_subscription_secret', // subscription.latest_invoice.payment_intent.client_secret
      status: 'incomplete'
    };
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(userId: string, atPeriodEnd: boolean = true): Promise<void> {
    this.ensureEnabled();

    // Get user's Stripe subscription
    const subscription = await this.getStripeSubscriptionByUserId(userId);
    if (!subscription) {
      throw new PaymentError('No active subscription found', 'NO_SUBSCRIPTION', 404);
    }

    // Cancel in Stripe
    // if (atPeriodEnd) {
    //   await this.stripe.subscriptions.update(subscription.stripe_subscription_id, {
    //     cancel_at_period_end: true
    //   });
    // } else {
    //   await this.stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    // }

    // Update our database
    await this.database.query(
      `UPDATE stripe_subscriptions SET 
        cancel_at_period_end = $1, 
        canceled_at = CASE WHEN $2 = false THEN CURRENT_TIMESTAMP ELSE canceled_at END,
        status = CASE WHEN $2 = false THEN 'canceled' ELSE status END,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3`,
      [atPeriodEnd, atPeriodEnd, userId]
    );

    logger.info('Subscription cancelled', { userId, atPeriodEnd });
  }

  /**
   * Get user's Stripe subscription
   */
  async getStripeSubscriptionByUserId(userId: string): Promise<StripeSubscription | null> {
    try {
      const query = `
        SELECT * FROM stripe_subscriptions 
        WHERE user_id = $1 AND status IN ('active', 'past_due', 'trialing')
        ORDER BY created_at DESC LIMIT 1
      `;
      const rows = await this.database.query(query, [userId]);
      
      if (rows.length === 0) {
        return null;
      }

      return this.mapStripeSubscriptionRow(rows[0]);
    } catch (error) {
      logger.debug('stripe_subscriptions table not found or error', { error });
      return null;
    }
  }

  // ============================================================================
  // WEBHOOK HANDLING
  // ============================================================================

  /**
   * Handle Stripe webhook events
   * Call this from your webhook endpoint
   */
  async handleWebhook(payload: string, signature: string): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('Webhook received but Stripe is not enabled');
      return;
    }

    // Verify webhook signature and parse event
    // const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // let event;
    // try {
    //   event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    // } catch (err) {
    //   throw new StripeError('Webhook signature verification failed');
    // }

    // // Check for idempotency - prevent processing same event twice
    // const eventExists = await this.checkWebhookEventProcessed(event.id);
    // if (eventExists) {
    //   logger.info('Webhook event already processed, skipping', { eventId: event.id });
    //   return;
    // }

    // // Record webhook event for idempotency
    // await this.recordWebhookEvent(event.id, event.type, payload);

    // try {
    //   // Handle different event types
    //   switch (event.type) {
    //     case 'payment_intent.succeeded':
    //       await this.handlePaymentIntentSucceeded(event.data.object);
    //       break;
    //     case 'payment_intent.payment_failed':
    //       await this.handlePaymentIntentFailed(event.data.object);
    //       break;
    //     case 'invoice.paid':
    //       await this.handleInvoicePaid(event.data.object);
    //       break;
    //     case 'invoice.payment_failed':
    //       await this.handleInvoicePaymentFailed(event.data.object);
    //       break;
    //     case 'customer.subscription.updated':
    //       await this.handleSubscriptionUpdated(event.data.object);
    //       break;
    //     case 'customer.subscription.deleted':
    //       await this.handleSubscriptionDeleted(event.data.object);
    //       break;
    //     default:
    //       logger.info('Unhandled webhook event', { type: event.type });
    //   }

    //   // Mark event as processed
    //   await this.markWebhookEventProcessed(event.id);
    // } catch (error) {
    //   // Record error but don't throw - Stripe will retry
    //   await this.recordWebhookEventError(event.id, error);
    //   throw error;
    // }

    logger.info('Webhook processed (placeholder)');
  }

  /**
   * Check if webhook event was already processed
   */
  private async checkWebhookEventProcessed(eventId: string): Promise<boolean> {
    try {
      const query = `SELECT processed FROM stripe_webhook_events WHERE stripe_event_id = $1`;
      const rows = await this.database.query(query, [eventId]);
      return rows.length > 0 && rows[0].processed;
    } catch (error) {
      return false;
    }
  }

  /**
   * Record webhook event for idempotency
   */
  private async recordWebhookEvent(eventId: string, eventType: string, payload: string): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO stripe_webhook_events (id, stripe_event_id, event_type, payload, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (stripe_event_id) DO NOTHING`,
        [uuidv4(), eventId, eventType, payload]
      );
    } catch (error) {
      logger.debug('Could not record webhook event', { error });
    }
  }

  /**
   * Mark webhook event as processed
   */
  private async markWebhookEventProcessed(eventId: string): Promise<void> {
    try {
      await this.database.query(
        `UPDATE stripe_webhook_events SET processed = true, processed_at = CURRENT_TIMESTAMP WHERE stripe_event_id = $1`,
        [eventId]
      );
    } catch (error) {
      logger.debug('Could not mark webhook event as processed', { error });
    }
  }

  /**
   * Record webhook event error
   */
  private async recordWebhookEventError(eventId: string, error: any): Promise<void> {
    try {
      await this.database.query(
        `UPDATE stripe_webhook_events SET error_message = $1 WHERE stripe_event_id = $2`,
        [error?.message || 'Unknown error', eventId]
      );
    } catch (err) {
      logger.debug('Could not record webhook event error', { err });
    }
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    const { id, metadata } = paymentIntent;
    const userId = metadata?.user_id;
    const paymentType = metadata?.payment_type;

    // Update payment status
    await this.database.query(
      `UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2`,
      [PaymentStatus.SUCCEEDED, id]
    );

    // Handle based on payment type
    if (paymentType === PaymentType.POINTS_PURCHASE) {
      const pointsAmount = parseInt(metadata?.points_amount || '0');
      if (pointsAmount > 0 && userId) {
        await this.grantPointsToUser(userId, pointsAmount, `Points purchase (${id})`);
      }
    }

    logger.info('Payment succeeded', { paymentIntentId: id, userId, paymentType });
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    const { id, last_payment_error } = paymentIntent;

    await this.database.query(
      `UPDATE payments SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $3`,
      [PaymentStatus.FAILED, last_payment_error?.message || 'Payment failed', id]
    );

    logger.warn('Payment failed', { paymentIntentId: id, error: last_payment_error?.message });
  }

  /**
   * Handle paid invoice (subscription renewal)
   */
  private async handleInvoicePaid(invoice: any): Promise<void> {
    const subscriptionId = invoice.subscription;
    const customerId = invoice.customer;

    if (!subscriptionId) return;

    // Get user from customer
    const customerQuery = `SELECT user_id FROM stripe_customers WHERE stripe_customer_id = $1`;
    const customerRows = await this.database.query(customerQuery, [customerId]);
    
    if (customerRows.length === 0) {
      logger.warn('Customer not found for invoice', { customerId });
      return;
    }

    const userId = customerRows[0].user_id;

    // Get the tier from stripe subscription
    const stripeSubQuery = `SELECT stripe_price_id FROM stripe_subscriptions WHERE stripe_subscription_id = $1`;
    const stripeSubRows = await this.database.query(stripeSubQuery, [subscriptionId]);
    
    let tierId = 'normal'; // default
    if (stripeSubRows.length > 0) {
      const priceId = stripeSubRows[0].stripe_price_id;
      if (priceId.includes('pro')) {
        tierId = 'pro';
      }
    }

    // Update stripe subscription status
    await this.database.query(
      `UPDATE stripe_subscriptions SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE stripe_subscription_id = $1`,
      [subscriptionId]
    );

    // Activate subscription in main system using SubscriptionService
    try {
      const subscriptionService = new SubscriptionService();
      await subscriptionService.upgradeSubscription({
        user_id: userId,
        target_tier_id: tierId,
        payment_method: 'stripe',
        auto_renew: true
      });
      logger.info('Invoice paid, subscription activated via SubscriptionService', { userId, subscriptionId, tierId });
    } catch (error) {
      logger.error('Failed to activate subscription via SubscriptionService', { userId, subscriptionId, error });
      // Still log success for the payment itself
      logger.info('Invoice paid, subscription status updated', { userId, subscriptionId });
    }
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    const subscriptionId = invoice.subscription;
    const customerId = invoice.customer;

    if (!subscriptionId) return;

    await this.database.query(
      `UPDATE stripe_subscriptions SET status = 'past_due', updated_at = CURRENT_TIMESTAMP WHERE stripe_subscription_id = $1`,
      [subscriptionId]
    );

    // Get user to send notification
    if (customerId) {
      try {
        const customerQuery = `SELECT user_id FROM stripe_customers WHERE stripe_customer_id = $1`;
        const customerRows = await this.database.query(customerQuery, [customerId]);
        
        if (customerRows.length > 0) {
          const userId = customerRows[0].user_id;
          // Record a notification for the user
          await this.database.query(
            `INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
             VALUES ($1, $2, 'payment_failed', 'Неуспешно плащане', 'Плащането за вашия абонамент не беше успешно. Моля, актуализирайте платежния си метод.', $3, CURRENT_TIMESTAMP)`,
            [uuidv4(), userId, JSON.stringify({ subscription_id: subscriptionId })]
          );
          logger.info('Payment failed notification created', { userId, subscriptionId });
        }
      } catch (notifError) {
        logger.debug('Could not create payment failed notification', { notifError });
      }
    }

    logger.warn('Invoice payment failed', { subscriptionId });
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const { id, status, current_period_start, current_period_end, cancel_at_period_end } = subscription;

    await this.database.query(
      `UPDATE stripe_subscriptions SET 
        status = $1, 
        current_period_start = $2, 
        current_period_end = $3,
        cancel_at_period_end = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE stripe_subscription_id = $5`,
      [status, new Date(current_period_start * 1000), new Date(current_period_end * 1000), cancel_at_period_end, id]
    );

    logger.info('Subscription updated', { subscriptionId: id, status });
  }

  /**
   * Handle subscription deleted/cancelled
   */
  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const { id } = subscription;

    // Get user from subscription
    const subQuery = `SELECT user_id FROM stripe_subscriptions WHERE stripe_subscription_id = $1`;
    const subRows = await this.database.query(subQuery, [id]);

    if (subRows.length > 0) {
      const userId = subRows[0].user_id;

      // Update subscription status
      await this.database.query(
        `UPDATE stripe_subscriptions SET status = 'canceled', canceled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE stripe_subscription_id = $1`,
        [id]
      );

      // Downgrade user to free tier
      await this.database.query(
        `UPDATE users SET subscription_tier_id = 'free', subscription_status = 'active' WHERE id = $1`,
        [userId]
      );

      logger.info('Subscription deleted, user downgraded to free', { userId, subscriptionId: id });
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get user email
   */
  private async getUserEmail(userId: string): Promise<string> {
    const query = `SELECT email FROM users WHERE id = $1`;
    const rows = await this.database.query(query, [userId]);
    
    if (rows.length === 0) {
      throw new PaymentError('User not found', 'USER_NOT_FOUND', 404);
    }

    return rows[0].email;
  }

  /**
   * Grant points to user
   */
  private async grantPointsToUser(userId: string, points: number, reason: string): Promise<void> {
    await this.database.query(
      `UPDATE users SET points_balance = points_balance + $1, points_total_earned = points_total_earned + $1 WHERE id = $2`,
      [points, userId]
    );

    // Record transaction
    await this.database.query(
      `INSERT INTO sp_points_transactions (id, user_id, transaction_type, points_amount, balance_after, reason)
       VALUES ($1, $2, 'earned', $3, (SELECT points_balance FROM users WHERE id = $2), $4)`,
      [uuidv4(), userId, points, reason]
    );

    logger.info('Points granted', { userId, points, reason });
  }

  /**
   * Record payment in database
   */
  private async recordPayment(payment: Partial<Payment>): Promise<void> {
    try {
      const query = `
        INSERT INTO payments (id, user_id, stripe_payment_intent_id, amount, currency, status, payment_type, payment_provider, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      await this.database.query(query, [
        payment.id,
        payment.user_id,
        payment.stripe_payment_intent_id,
        payment.amount,
        payment.currency,
        payment.status,
        payment.payment_type,
        payment.payment_provider,
        JSON.stringify(payment.metadata || {})
      ]);
    } catch (error) {
      logger.debug('Could not record payment, table may not exist', { error });
    }
  }

  /**
   * Record Stripe subscription in database
   */
  private async recordStripeSubscription(subscription: Partial<StripeSubscription>): Promise<void> {
    try {
      const query = `
        INSERT INTO stripe_subscriptions (id, user_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, status, current_period_start, current_period_end)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id) DO UPDATE SET
          stripe_subscription_id = $3,
          stripe_price_id = $5,
          status = $6,
          current_period_start = $7,
          current_period_end = $8,
          updated_at = CURRENT_TIMESTAMP
      `;
      await this.database.query(query, [
        subscription.id,
        subscription.user_id,
        subscription.stripe_subscription_id,
        subscription.stripe_customer_id,
        subscription.stripe_price_id,
        subscription.status,
        subscription.current_period_start,
        subscription.current_period_end
      ]);
    } catch (error) {
      logger.debug('Could not record subscription, table may not exist', { error });
    }
  }

  /**
   * Get available points packages
   */
  getPointsPackages(): PointsPackage[] {
    return POINTS_PACKAGES.filter(p => p.is_active);
  }

  /**
   * Get subscription prices
   */
  getSubscriptionPrices(): typeof SUBSCRIPTION_PRICES {
    return SUBSCRIPTION_PRICES;
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(userId: string, limit: number = 50): Promise<Payment[]> {
    try {
      const query = `
        SELECT * FROM payments 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `;
      const rows = await this.database.query(query, [userId, limit]);
      return rows.map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        stripe_payment_intent_id: row.stripe_payment_intent_id,
        stripe_invoice_id: row.stripe_invoice_id,
        amount: parseFloat(row.amount),
        currency: row.currency,
        status: row.status,
        payment_type: row.payment_type,
        payment_provider: row.payment_provider,
        description: row.description,
        metadata: row.metadata,
        error_message: row.error_message,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      logger.debug('Could not fetch payment history, table may not exist', { error });
      return [];
    }
  }

  // ============================================================================
  // ROW MAPPERS
  // ============================================================================

  private mapCustomerRow(row: any): StripeCustomer {
    return {
      id: row.id,
      user_id: row.user_id,
      stripe_customer_id: row.stripe_customer_id,
      email: row.email,
      default_payment_method_id: row.default_payment_method_id,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private mapStripeSubscriptionRow(row: any): StripeSubscription {
    return {
      id: row.id,
      user_id: row.user_id,
      stripe_subscription_id: row.stripe_subscription_id,
      stripe_customer_id: row.stripe_customer_id,
      stripe_price_id: row.stripe_price_id,
      status: row.status,
      current_period_start: row.current_period_start,
      current_period_end: row.current_period_end,
      cancel_at_period_end: row.cancel_at_period_end,
      canceled_at: row.canceled_at,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

// Singleton instance
let stripeServiceInstance: StripeService | null = null;

export function getStripeService(): StripeService {
  if (!stripeServiceInstance) {
    stripeServiceInstance = new StripeService();
  }
  return stripeServiceInstance;
}
