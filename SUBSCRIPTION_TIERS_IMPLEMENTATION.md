# Service Provider Subscription Tiers Implementation Plan

**Project**: ServiceText Pro - 3-Tier Subscription System  
**Date**: October 31, 2025  
**Version**: 1.0  
**Status**: Implementation in Progress

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Tier Structure](#tier-structure)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Mobile App Changes](#mobile-app-changes)
6. [Web Marketplace Changes](#web-marketplace-changes)
7. [Feature Distribution](#feature-distribution)
8. [Future Enhancements](#future-enhancements)
9. [Implementation Checklist](#implementation-checklist)
10. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### Objective
Implement a 3-tier subscription system for Service Providers (SPs) to monetize the platform and provide differentiated value propositions.

### Tiers Overview

| Tier | Price | Target Audience |
|------|-------|----------------|
| **FREE** | 0 BGN/month | New SPs, testing the platform |
| **NORMAL** | 250 BGN/month | Growing businesses, regular work |
| **PRO** | 350 BGN/month | Established SPs, premium positioning |

### Key Features
- ✅ No payment provider integration (manual management initially)
- ✅ Tier-based feature access control
- ✅ Usage tracking and limits
- ✅ Premium listing and bidding system (PRO tier)
- ✅ Extensible architecture for future features

---

## Tier Structure

### FREE Tier (Default)
**Price**: 0 BGN/month  
**Target**: Entry-level service providers

**Features**:
- ✓ Basic profile listing
- ✓ Standard search visibility
- ✓ Customer reviews
- ✓ Case notifications
- ✓ Chat messaging
- ✓ Photo gallery (max 5 photos)

**Limits**:
- Max 2 service categories
- Max 5 gallery photos
- Max 2 certificates
- 10 case responses per month
- Standard search ranking
- No analytics access
- No priority support

### NORMAL Tier
**Price**: 250 BGN/month  
**Target**: Growing service providers

**Features**:
- ✓ All FREE features
- ✓ Enhanced search visibility
- ✓ Video gallery
- ✓ Basic analytics dashboard
- ✓ Priority notifications
- ✓ Verified badge
- ✓ Social media links
- ✓ Business hours display

**Limits**:
- Max 5 service categories
- Max 20 gallery photos
- Max 10 certificates
- 50 case responses per month
- Enhanced search ranking
- Analytics access
- Premium badge

### PRO Tier
**Price**: 350 BGN/month  
**Target**: Established, premium service providers

**Features**:
- ✓ All NORMAL features
- ✓ Premium search visibility
- ✓ Advanced analytics
- ✓ Featured listing
- ✓ Bidding system for premium spots
- ✓ Priority support
- ✓ Custom branding
- ✓ API access
- ✓ Lead generation tools

**Limits**:
- Unlimited service categories
- Max 100 gallery photos
- Unlimited certificates
- Unlimited case responses
- Premium search ranking (top positions)
- Full analytics suite
- Up to 10 active bids simultaneously

---

## Database Schema

### New Tables Created

#### 1. `subscription_tiers`
Stores tier definitions and pricing.

```sql
CREATE TABLE subscription_tiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    name_bg TEXT NOT NULL,
    description TEXT,
    description_bg TEXT,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'BGN',
    features JSONB NOT NULL DEFAULT '{}',
    limits JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. `sp_subscriptions`
Tracks active subscriptions for each user.

```sql
CREATE TABLE sp_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier_id TEXT NOT NULL REFERENCES subscription_tiers(id),
    status TEXT NOT NULL DEFAULT 'active',
    started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    cancelled_at TIMESTAMP WITHOUT TIME ZONE,
    auto_renew BOOLEAN NOT NULL DEFAULT false,
    payment_method TEXT,
    last_payment_date TIMESTAMP WITHOUT TIME ZONE,
    next_payment_date TIMESTAMP WITHOUT TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. `sp_subscription_history`
Audit trail for subscription changes.

#### 4. `sp_premium_bids`
PRO tier bidding system for premium listing spots.

#### 5. `sp_feature_usage`
Tracks monthly feature usage against limits.

### Modified Tables

#### `users` table
Added columns:
- `subscription_tier_id` - Current tier (FK to subscription_tiers)
- `subscription_status` - active, expired, cancelled, pending
- `subscription_expires_at` - Expiration date

#### `service_provider_profiles` table
Added columns:
- `is_premium` - Boolean flag for NORMAL/PRO tiers
- `premium_listing_priority` - Ranking score (0-100)
- `featured_until` - Featured listing expiration
- `profile_views_count` - Analytics tracking
- `contact_clicks_count` - Analytics tracking

---

## Backend Implementation

### Files Created

#### 1. `/backend/migrations/001_add_subscription_tiers.sql`
Complete database migration script.

**Status**: ✅ Created  
**Location**: `/var/www/servicetextpro/backend/migrations/001_add_subscription_tiers.sql`

#### 2. `/backend/src/types/subscription.ts`
TypeScript type definitions for subscription system.

**Key Types**:
- `SubscriptionTier` enum
- `SubscriptionStatus` enum
- `TierFeatures` interface
- `TierLimits` interface
- `SPSubscription` interface
- Error classes: `SubscriptionError`, `FeatureLimitError`, `TierRequirementError`

**Status**: ✅ Created

#### 3. `/backend/src/services/SubscriptionService.ts`
Core business logic for subscription management.

**Key Methods**:
- `getAllTiers()` - Fetch all available tiers
- `getUserTier(userId)` - Get user's current tier
- `upgradeSubscription(request)` - Upgrade/downgrade tier
- `cancelSubscription(request)` - Cancel subscription
- `checkFeatureAccess(check)` - Verify feature access and limits
- `getTierComparison()` - Get tier comparison data

**Status**: ✅ Created

#### 4. `/backend/src/middleware/subscriptionMiddleware.ts`
Express middleware for tier-based access control.

**Middleware Functions**:
- `requireTier(minimumTier)` - Require minimum tier level
- `checkFeatureAccess(feature, increment)` - Check and track feature usage
- `checkMonthlyLimit(limitKey)` - Enforce monthly limits
- `attachTierInfo` - Attach tier data to request

**Status**: ✅ Created

#### 5. `/backend/src/controllers/subscriptionController.ts`
API endpoints for subscription management.

**Endpoints**:
- `GET /api/v1/subscriptions/tiers` - List all tiers
- `GET /api/v1/subscriptions/tiers/comparison` - Tier comparison
- `GET /api/v1/subscriptions/my-subscription` - User's subscription
- `POST /api/v1/subscriptions/upgrade` - Upgrade tier
- `POST /api/v1/subscriptions/cancel` - Cancel subscription
- `GET /api/v1/subscriptions/feature-access/:feature` - Check feature access

**Status**: ✅ Created

### Integration Required

#### Update `/backend/src/server.ts`
Add subscription routes:

```typescript
import subscriptionController from './controllers/subscriptionController';
app.use('/api/v1/subscriptions', subscriptionController);
```

#### Update `/backend/src/types/index.ts`
Export subscription types:

```typescript
export * from './subscription';
```

---

## Mobile App Changes

### Files Created

#### 1. `/mobile-app/src/components/TierSelectionCard.tsx`
Reusable tier selection card component.

**Props**:
- `tier`: Tier data object
- `selected`: Boolean
- `onSelect`: Callback function

**Status**: ✅ Created

### Files to Modify

#### 1. `/mobile-app/src/screens/AuthScreen.tsx`
Add tier selection step during registration.

**Changes Needed**:
1. Add `selectedTier` state
2. Add tier selection UI after service category
3. Pass `subscription_tier_id` in registration payload
4. Show tier benefits during selection

**Status**: 🔄 In Progress

#### 2. `/mobile-app/src/screens/SettingsScreen.tsx`
Add subscription management section.

**Features**:
- Display current tier
- Show tier benefits
- Upgrade/downgrade options
- Subscription history
- Cancel subscription

**Status**: ⏳ Pending

#### 3. `/mobile-app/src/services/ApiService.ts`
Add subscription API methods.

```typescript
async getSubscriptionTiers(): Promise<ApiResponse<any>>
async getMySubscription(): Promise<ApiResponse<any>>
async upgradeSubscription(tierId: string): Promise<ApiResponse<any>>
async cancelSubscription(subscriptionId: string): Promise<ApiResponse<any>>
```

**Status**: ⏳ Pending

---

## Web Marketplace Changes

### Files to Modify

#### 1. `/Marketplace/src/app/auth/register/page.tsx`
Add tier selection during SP registration.

**Changes Needed**:
1. Import tier selection component
2. Add tier selection step
3. Update registration payload
4. Show tier comparison table

**Status**: ⏳ Pending

#### 2. Create `/Marketplace/src/components/TierComparisonTable.tsx`
Web component for tier comparison.

**Features**:
- Responsive table/card layout
- Feature comparison
- Pricing display
- "Recommended" badge for NORMAL tier
- Call-to-action buttons

**Status**: ⏳ Pending

#### 3. Create `/Marketplace/src/app/subscription/page.tsx`
Subscription management page for logged-in SPs.

**Features**:
- Current subscription display
- Tier upgrade/downgrade
- Billing history (future)
- Usage statistics
- Cancel subscription

**Status**: ⏳ Pending

---

## Feature Distribution

### Search & Discovery

| Feature | FREE | NORMAL | PRO |
|---------|------|--------|-----|
| Basic listing | ✓ | ✓ | ✓ |
| Search visibility | Standard | Enhanced | Premium |
| Featured listing | ✗ | ✗ | ✓ |
| Premium badge | ✗ | ✓ | ✓ |
| Verified badge | ✗ | ✓ | ✓ |
| Bidding for top spots | ✗ | ✗ | ✓ |

### Profile & Content

| Feature | FREE | NORMAL | PRO |
|---------|------|--------|-----|
| Service categories | 2 | 5 | Unlimited |
| Photo gallery | 5 photos | 20 photos | 100 photos |
| Video gallery | ✗ | ✓ | ✓ |
| Certificates | 2 | 10 | Unlimited |
| Social media links | ✗ | ✓ | ✓ |
| Business hours | ✗ | ✓ | ✓ |
| Custom branding | ✗ | ✗ | ✓ |

### Communication & Cases

| Feature | FREE | NORMAL | PRO |
|---------|------|--------|-----|
| Chat messaging | ✓ | ✓ | ✓ |
| Case notifications | Standard | Priority | Priority |
| Monthly case responses | 10 | 50 | Unlimited |
| Lead generation | ✗ | ✗ | ✓ |

### Analytics & Insights

| Feature | FREE | NORMAL | PRO |
|---------|------|--------|-----|
| Profile views | ✗ | ✓ | ✓ |
| Contact clicks | ✗ | ✓ | ✓ |
| Basic analytics | ✗ | ✓ | ✓ |
| Advanced analytics | ✗ | ✗ | ✓ |
| Export reports | ✗ | ✗ | ✓ |

### Support & Services

| Feature | FREE | NORMAL | PRO |
|---------|------|--------|-----|
| Email support | Standard | Standard | Priority |
| Response time | 48h | 24h | 4h |
| Dedicated account manager | ✗ | ✗ | ✓ |
| API access | ✗ | ✗ | ✓ |

---

## Future Enhancements

### Phase 2: Payment Integration
- Stripe/PayPal integration
- Automated billing
- Invoice generation
- Payment history
- Refund management

### Phase 3: Advanced Features
- **Bidding System**: PRO users bid for premium listing spots
- **A/B Testing**: Test different profile variations
- **Smart Matching**: AI-powered customer matching
- **Referral Program**: Earn credits for referrals
- **White Label**: Custom branding for PRO users

### Phase 4: Analytics & Reporting
- Conversion tracking
- ROI calculator
- Competitor analysis
- Market insights
- Custom reports

### Phase 5: Marketing Tools
- Email campaigns
- SMS marketing
- Social media integration
- Review management
- Reputation monitoring

---

## Implementation Checklist

### Database
- [x] Create migration script
- [x] Define subscription_tiers table
- [x] Define sp_subscriptions table
- [x] Define sp_subscription_history table
- [x] Define sp_premium_bids table
- [x] Define sp_feature_usage table
- [x] Add tier columns to users table
- [x] Add premium columns to service_provider_profiles
- [x] Create indexes for performance
- [x] Insert default tier data
- [ ] Run migration on production database

### Backend
- [x] Create TypeScript types
- [x] Create SubscriptionService
- [x] Create subscription middleware
- [x] Create subscription controller
- [ ] Update server.ts with routes
- [ ] Update AuthService for tier assignment
- [ ] Add tier validation to registration
- [ ] Create tier upgrade/downgrade logic
- [ ] Implement feature access checks
- [ ] Add usage tracking
- [ ] Create admin endpoints for tier management

### Mobile App
- [x] Create TierSelectionCard component
- [ ] Update AuthScreen with tier selection
- [ ] Create SubscriptionScreen
- [ ] Update SettingsScreen
- [ ] Add tier badge to profile
- [ ] Implement upgrade flow
- [ ] Add usage indicators
- [ ] Create tier comparison view
- [ ] Add API service methods

### Web Marketplace
- [ ] Create TierComparisonTable component
- [ ] Update registration page
- [ ] Create subscription management page
- [ ] Add tier selection to SP registration
- [ ] Create upgrade/downgrade flow
- [ ] Add tier badge to SP profiles
- [ ] Implement feature restrictions
- [ ] Create admin tier management UI

### Testing
- [ ] Unit tests for SubscriptionService
- [ ] Integration tests for API endpoints
- [ ] E2E tests for registration flow
- [ ] E2E tests for upgrade/downgrade
- [ ] Test feature access restrictions
- [ ] Test usage limit enforcement
- [ ] Load testing for tier queries
- [ ] Security testing for tier bypass attempts

### Documentation
- [x] Create implementation plan
- [ ] API documentation
- [ ] User guide for SPs
- [ ] Admin guide
- [ ] Migration guide
- [ ] Troubleshooting guide

---

## Testing Strategy

### Unit Testing
```typescript
// Test SubscriptionService
describe('SubscriptionService', () => {
  test('should get user tier', async () => {
    const tier = await service.getUserTier(userId);
    expect(tier).toBe(SubscriptionTier.FREE);
  });

  test('should check feature access', async () => {
    const result = await service.checkFeatureAccess({
      user_id: userId,
      feature_key: 'gallery_photos',
      increment: false
    });
    expect(result.allowed).toBe(true);
  });
});
```

### Integration Testing
```typescript
// Test subscription endpoints
describe('POST /api/v1/subscriptions/upgrade', () => {
  test('should upgrade to NORMAL tier', async () => {
    const response = await request(app)
      .post('/api/v1/subscriptions/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ tier_id: 'normal' });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### E2E Testing
- Registration with tier selection
- Tier upgrade flow
- Feature access enforcement
- Usage limit tracking
- Subscription cancellation

---

## Migration Steps

### Step 1: Database Migration
```bash
# Connect to PostgreSQL
psql -U postgres -d servicetextpro

# Run migration
\i /var/www/servicetextpro/backend/migrations/001_add_subscription_tiers.sql

# Verify tables created
\dt subscription*
\dt sp_*

# Check tier data
SELECT * FROM subscription_tiers;
```

### Step 2: Backend Deployment
```bash
# Build TypeScript
cd /var/www/servicetextpro/backend
npm run build

# Restart server
pm2 restart servicetextpro-backend
```

### Step 3: Mobile App Update
```bash
# Build and deploy
cd /var/www/servicetextpro/mobile-app
npm run build:android
npm run build:ios
```

### Step 4: Web Deployment
```bash
# Build Next.js app
cd /var/www/servicetextpro/Marketplace
npm run build
pm2 restart servicetextpro-marketplace
```

---

## Notes

### Current Limitations
1. **No Payment Integration**: Manual subscription management initially
2. **No Automated Billing**: Subscriptions don't auto-renew
3. **No Invoice Generation**: Manual invoicing required
4. **No Refunds**: Manual refund process

### Future Considerations
1. **Payment Gateway**: Stripe or PayPal integration
2. **Automated Emails**: Subscription confirmations, renewals, cancellations
3. **Dunning Management**: Handle failed payments
4. **Proration**: Handle mid-month upgrades/downgrades
5. **Discounts & Coupons**: Promotional pricing
6. **Annual Plans**: Discounted annual subscriptions

---

## Support & Maintenance

### Monitoring
- Track subscription conversions
- Monitor tier distribution
- Analyze feature usage
- Track upgrade/downgrade patterns

### Maintenance Tasks
- Monthly: Review tier pricing
- Quarterly: Analyze feature usage
- Annually: Review tier structure
- Ongoing: Monitor competitor pricing

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Next Review**: November 30, 2025
