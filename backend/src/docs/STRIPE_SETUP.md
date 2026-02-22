# Stripe Payment Integration Setup Guide

This document describes how to enable the Stripe payment integration when you're ready.

## Prerequisites

1. **Registered Company** - You need a registered business in Bulgaria
2. **Stripe Account** - Create at https://stripe.com
3. **Bank Account** - For receiving payouts

## Step 1: Stripe Dashboard Setup

### 1.1 Create Products and Prices

In Stripe Dashboard → Products, create:

**Subscription Products:**
| Product Name | Price ID (example) | Amount | Interval |
|--------------|-------------------|--------|----------|
| Normal Yearly | price_normal_yearly | 179.00 EUR | yearly |
| Pro Yearly | price_pro_yearly | 249.00 EUR | yearly |

**Points Packages (One-time):**
| Product Name | Price ID (example) | Amount |
|--------------|-------------------|--------|
| 50 Points | price_points_50 | 7.50 EUR |
| 100 Points | price_points_100 | 14.00 EUR |
| 200 Points | price_points_200 | 26.00 EUR |
| 500 Points | price_points_500 | 60.00 EUR |

### 1.2 Get API Keys

From Stripe Dashboard → Developers → API Keys:
- **Publishable Key**: `pk_live_...` (for mobile app)
- **Secret Key**: `sk_live_...` (for backend)

### 1.3 Set Up Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Webhook Signing Secret**: `whsec_...`

## Step 2: Backend Configuration

### 2.1 Install Stripe SDK

```bash
cd /var/www/servicetextpro/backend
npm install stripe
```

### 2.2 Environment Variables

Add to `/var/www/servicetextpro/backend/.env`:

```env
# Stripe Configuration
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key

# Stripe Price IDs
STRIPE_PRICE_NORMAL_YEARLY=price_your_normal_yearly_id
STRIPE_PRICE_PRO_YEARLY=price_your_pro_yearly_id
STRIPE_PRICE_POINTS_50=price_your_points_50_id
STRIPE_PRICE_POINTS_100=price_your_points_100_id
STRIPE_PRICE_POINTS_200=price_your_points_200_id
STRIPE_PRICE_POINTS_500=price_your_points_500_id
```

### 2.3 Create Database Tables

Run the migration script:

```bash
cd /var/www/servicetextpro/backend
npx ts-node src/scripts/createPaymentTables.ts
```

### 2.4 Enable Stripe in Service

Edit `/var/www/servicetextpro/backend/src/services/StripeService.ts`:

Uncomment the Stripe initialization code:

```typescript
private initializeStripe(): void {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeEnabled = process.env.STRIPE_ENABLED === 'true';

  if (stripeEnabled && stripeSecretKey) {
    try {
      const Stripe = require('stripe');
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
        typescript: true,
      });
      this.isEnabled = true;
      
      logger.info('Stripe service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Stripe', { error });
      this.isEnabled = false;
    }
  }
}
```

### 2.5 Add Payment Routes

Add to your Express app (e.g., in `app.ts` or routes file):

```typescript
import * as paymentController from './controllers/paymentController';

// Payment routes
app.get('/api/payments/status', authMiddleware, paymentController.getPaymentStatus);
app.get('/api/payments/points-packages', authMiddleware, paymentController.getPointsPackages);
app.get('/api/payments/subscription-prices', authMiddleware, paymentController.getSubscriptionPrices);
app.post('/api/payments/create-payment-intent', authMiddleware, paymentController.createPaymentIntent);
app.post('/api/payments/create-setup-intent', authMiddleware, paymentController.createSetupIntent);
app.post('/api/payments/create-subscription', authMiddleware, paymentController.createSubscription);
app.post('/api/payments/cancel-subscription', authMiddleware, paymentController.cancelSubscription);
app.get('/api/payments/history', authMiddleware, paymentController.getPaymentHistory);

// Webhook (no auth - Stripe signs requests)
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);
```

### 2.6 Restart Backend

```bash
sudo pm2 restart all
```

## Step 3: Mobile App Configuration

### 3.1 Install Stripe React Native

```bash
cd /var/www/servicetextpro/mobile-app
npm install @stripe/stripe-react-native
```

### 3.2 iOS Setup (if applicable)

Add to `ios/Podfile`:
```ruby
pod 'Stripe', '~> 23.0'
```

Run:
```bash
cd ios && pod install
```

### 3.3 Android Setup

Add to `android/app/build.gradle`:
```gradle
dependencies {
    implementation 'com.stripe:stripe-android:20.+'
}
```

### 3.4 Initialize Stripe Provider

Edit `App.tsx`:

```tsx
import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = 'pk_live_your_publishable_key';

function App() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      {/* Your app content */}
    </StripeProvider>
  );
}
```

### 3.5 Enable PaymentSheet Component

Edit `/var/www/servicetextpro/mobile-app/src/components/PaymentSheet.tsx`:

Uncomment the Stripe imports and implementation.

### 3.6 Build and Deploy

Build new APK with Stripe integration.

## Step 4: Testing

### 4.1 Use Test Mode First

Before going live:
1. Use Stripe test keys (`pk_test_...`, `sk_test_...`)
2. Test with Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Declined: `4000 0000 0000 0002`
   - 3D Secure: `4000 0025 0000 3155`

### 4.2 Test Webhooks Locally

Use Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 4.3 Test Scenarios

- [ ] Points purchase (one-time payment)
- [ ] Subscription creation (Normal tier)
- [ ] Subscription creation (Pro tier)
- [ ] Subscription cancellation
- [ ] Failed payment handling
- [ ] Webhook processing

## Step 5: Go Live

1. Switch to live API keys
2. Verify webhook endpoint is accessible
3. Test with a real card (small amount)
4. Monitor Stripe Dashboard for events

## Files Created

### Backend:
- `src/types/payment.ts` - Payment type definitions
- `src/services/StripeService.ts` - Stripe integration service
- `src/controllers/paymentController.ts` - Payment API endpoints
- `src/scripts/createPaymentTables.ts` - Database migration

### Mobile App:
- `src/services/PaymentService.ts` - Payment API client
- `src/components/PaymentSheet.tsx` - Payment UI component

## Support

For issues with Stripe integration:
- Stripe Documentation: https://stripe.com/docs
- Stripe React Native: https://github.com/stripe/stripe-react-native
- Stripe API Reference: https://stripe.com/docs/api
