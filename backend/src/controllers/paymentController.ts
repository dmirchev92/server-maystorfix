/**
 * Payment Controller
 * Handles payment-related API endpoints
 * 
 * IMPORTANT: These endpoints are prepared but will return "not available" 
 * until Stripe is enabled in the environment configuration.
 */

import { Request, Response } from 'express';
import { getStripeService } from '../services/StripeService';
import { PaymentType, PaymentError } from '../types/payment';
import logger from '../utils/logger';

const stripeService = getStripeService();

/**
 * Check if payment system is available
 * GET /api/payments/status
 */
export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const isEnabled = stripeService.isStripeEnabled();
    
    res.json({
      success: true,
      data: {
        enabled: isEnabled,
        provider: 'stripe',
        message: isEnabled 
          ? 'Payment system is active' 
          : 'Payment system is not yet available. Contact support for manual payment options.'
      }
    });
  } catch (error: any) {
    logger.error('Error checking payment status', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to check payment status' }
    });
  }
};

/**
 * Get available points packages
 * GET /api/payments/points-packages
 */
export const getPointsPackages = async (req: Request, res: Response): Promise<void> => {
  try {
    const packages = stripeService.getPointsPackages();
    const isEnabled = stripeService.isStripeEnabled();

    res.json({
      success: true,
      data: {
        packages,
        payment_enabled: isEnabled,
        currency: 'EUR'
      }
    });
  } catch (error: any) {
    logger.error('Error fetching points packages', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch points packages' }
    });
  }
};

/**
 * Get subscription prices
 * GET /api/payments/subscription-prices
 */
export const getSubscriptionPrices = async (req: Request, res: Response): Promise<void> => {
  try {
    const prices = stripeService.getSubscriptionPrices();
    const isEnabled = stripeService.isStripeEnabled();

    res.json({
      success: true,
      data: {
        prices,
        payment_enabled: isEnabled,
        currency: 'EUR'
      }
    });
  } catch (error: any) {
    logger.error('Error fetching subscription prices', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch subscription prices' }
    });
  }
};

/**
 * Create payment intent for points purchase
 * POST /api/payments/create-payment-intent
 * Body: { points_package_id: string }
 */
export const createPaymentIntent = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }

    const { points_package_id } = req.body;
    if (!points_package_id) {
      res.status(400).json({ success: false, error: { message: 'Points package ID is required' } });
      return;
    }

    // Find the package
    const packages = stripeService.getPointsPackages();
    const selectedPackage = packages.find(p => p.id === points_package_id);
    
    if (!selectedPackage) {
      res.status(400).json({ success: false, error: { message: 'Invalid points package' } });
      return;
    }

    const result = await stripeService.createPaymentIntent({
      user_id: userId,
      amount: selectedPackage.price,
      currency: selectedPackage.currency,
      payment_type: PaymentType.POINTS_PURCHASE,
      metadata: {
        points_package_id,
        points_amount: selectedPackage.points
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error creating payment intent', { error });
    
    if (error instanceof PaymentError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.code }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { message: 'Failed to create payment intent' }
    });
  }
};

/**
 * Create setup intent (save card for future use)
 * POST /api/payments/create-setup-intent
 */
export const createSetupIntent = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }

    const result = await stripeService.createSetupIntent({ user_id: userId });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error creating setup intent', { error });
    
    if (error instanceof PaymentError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.code }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { message: 'Failed to create setup intent' }
    });
  }
};

/**
 * Create subscription
 * POST /api/payments/create-subscription
 * Body: { tier_id: 'normal' | 'pro', payment_method_id?: string }
 */
export const createSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }

    const { tier_id, payment_method_id } = req.body;
    if (!tier_id || !['normal', 'pro'].includes(tier_id)) {
      res.status(400).json({ success: false, error: { message: 'Valid tier_id (normal or pro) is required' } });
      return;
    }

    const result = await stripeService.createSubscription({
      user_id: userId,
      tier_id,
      payment_method_id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error creating subscription', { error });
    
    if (error instanceof PaymentError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.code }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { message: 'Failed to create subscription' }
    });
  }
};

/**
 * Cancel subscription
 * POST /api/payments/cancel-subscription
 * Body: { immediate?: boolean }
 */
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }

    const { immediate = false } = req.body;

    await stripeService.cancelSubscription(userId, !immediate);

    res.json({
      success: true,
      data: {
        message: immediate 
          ? 'Subscription cancelled immediately' 
          : 'Subscription will be cancelled at the end of the billing period'
      }
    });
  } catch (error: any) {
    logger.error('Error cancelling subscription', { error });
    
    if (error instanceof PaymentError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.code }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { message: 'Failed to cancel subscription' }
    });
  }
};

/**
 * Stripe webhook handler
 * POST /api/webhooks/stripe
 */
export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    // req.body should be raw buffer for webhook verification
    const payload = req.body;

    await stripeService.handleWebhook(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      signature
    );

    res.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook error', { error });
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get user's payment history
 * GET /api/payments/history
 */
export const getPaymentHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const payments = await stripeService.getPaymentHistory(userId, limit);

    res.json({
      success: true,
      data: {
        payments,
        count: payments.length
      }
    });
  } catch (error: any) {
    logger.error('Error fetching payment history', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch payment history' }
    });
  }
};
