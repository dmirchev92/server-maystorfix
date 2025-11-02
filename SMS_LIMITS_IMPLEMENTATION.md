# SMS Limits Implementation for NORMAL Tier

## Overview
Implemented monthly SMS limits for NORMAL tier users with the ability to purchase additional SMS packages.

## Tier SMS Limits

| Tier | Monthly SMS Limit | Notes |
|------|------------------|-------|
| **FREE** | 0 | Cannot send SMS (trial system blocks case acceptance) |
| **NORMAL** | 15 | Can purchase additional 15 SMS for 40 BGN |
| **PRO** | 25 | Can purchase additional 15 SMS for 40 BGN |

## Features Implemented

### 1. Database Schema (`migrations/007_add_sms_limits.sql`)

#### Updated Tables:
- **`subscription_tiers`**: Added `monthly_sms_limit` to limits JSONB
- **`sms_settings`**: Added columns:
  - `monthly_sms_count` - SMS sent this month
  - `monthly_period_start` - Start of current billing period
  - `addon_sms_remaining` - SMS remaining from purchased packages

#### New Table: `sp_sms_packages`
Tracks SMS package purchases:
- Package type: `addon_15` (15 SMS for 40 BGN)
- Tracks usage: `sms_used`, `sms_remaining`
- Status: `active`, `expired`, `depleted`
- Payment tracking: `payment_method`, `payment_reference`

### 2. Backend Service (`src/services/SMSLimitService.ts`)

#### Key Methods:

**`checkSMSLimit(userId)`**
- Returns current SMS usage status
- Checks monthly limit and addon packages
- Auto-resets counter on new month
- Returns:
  ```typescript
  {
    canSend: boolean,
    monthlyLimit: number,
    monthlyUsed: number,
    monthlyRemaining: number,
    addonRemaining: number,
    totalRemaining: number,
    tier: SubscriptionTier,
    periodStart: Date,
    periodEnd: Date,
    reason?: string
  }
  ```

**`incrementSMSUsage(userId)`**
- Increments SMS counter after successful send
- Uses addon SMS first, then monthly allowance
- Throws error if limit exceeded

**`purchaseSMSPackage(request)`**
- Creates SMS package purchase record
- Adds 15 SMS to user's addon balance
- Available for NORMAL and PRO tier users
- Price: 40 BGN

**`getSMSPackages(userId)`**
- Returns user's SMS package purchase history

### 3. API Endpoints (`src/controllers/smsController.ts`)

#### New Endpoints:

**`GET /api/v1/sms/limit-status`**
- Get current SMS limit status
- Response includes usage, limits, and tier info

**`POST /api/v1/sms/purchase-package`**
- Purchase 15 SMS for 40 BGN
- Body: `{ payment_method?, payment_reference? }`
- Returns package details

**`GET /api/v1/sms/packages`**
- Get SMS package purchase history
- Returns list of all purchased packages

#### Updated Endpoint:

**`POST /api/v1/sms/send-missed-call`**
- Now checks SMS limit before sending
- Returns `SMS_LIMIT_EXCEEDED` error if limit reached
- Increments counter after successful send

### 4. Type Definitions (`src/types/subscription.ts`)

Added:
- `monthly_sms_limit` to `TierLimits` interface
- `SPSMSPackage` interface for package tracking
- `SMSLimitStatus` interface for limit checking

## Usage Flow

### For NORMAL Tier Users (15 SMS/month):

1. **Check Limit Before Sending**
   ```typescript
   const status = await SMSLimitService.checkSMSLimit(userId);
   if (!status.canSend) {
     // Show purchase option
   }
   ```

2. **Send SMS** (if limit allows)
   ```typescript
   POST /api/v1/sms/send-missed-call
   // Automatically checks limit and increments counter
   ```

3. **Purchase Additional SMS** (when limit reached)
   ```typescript
   POST /api/v1/sms/purchase-package
   {
     "payment_method": "stripe",
     "payment_reference": "pi_xxx"
   }
   // Adds 15 SMS to addon balance
   ```

4. **View Usage**
   ```typescript
   GET /api/v1/sms/limit-status
   // Returns current usage and remaining SMS
   ```

### For PRO Tier Users (25 SMS/month):

Same flow as NORMAL tier, but with 25 SMS monthly allowance instead of 15.
Can also purchase addon packages (15 SMS for 40 BGN) when limit is reached.

## SMS Counter Logic

### Priority Order:
1. **Addon SMS** (from purchased packages) - used first
2. **Monthly Allowance** (15 for NORMAL, 25 for PRO) - used after addons depleted

### Monthly Reset:
- Counter resets automatically on the 1st of each month
- Addon SMS do NOT expire (carry over)
- Tracked per user in `sms_settings.monthly_period_start`

### Package Depletion:
- When addon package reaches 0 SMS, status changes to `depleted`
- Oldest packages are consumed first (FIFO)

## Migration Instructions

1. **Run Migration**
   ```bash
   psql -U your_user -d your_database -f backend/migrations/007_add_sms_limits.sql
   ```

2. **Restart Backend**
   ```bash
   cd backend
   npm run build
   npm run start
   ```

3. **Verify**
   ```bash
   # Check tier limits
   SELECT id, name, limits->'monthly_sms_limit' FROM subscription_tiers;
   
   # Check SMS settings
   SELECT user_id, monthly_sms_count, addon_sms_remaining FROM sms_settings LIMIT 5;
   ```

## Frontend Integration (TODO)

### Mobile App Updates Needed:
1. Display SMS usage in SMS settings screen
2. Show "Purchase More SMS" button when limit reached
3. Display package purchase history
4. Handle `SMS_LIMIT_EXCEEDED` error gracefully

### Marketplace Web Updates Needed:
1. Add SMS usage widget to dashboard
2. Implement SMS package purchase flow
3. Show upgrade prompt for FREE users
4. Display remaining SMS count

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `SMS_LIMIT_EXCEEDED` | Monthly limit or addon depleted | 403 |
| `TIER_REQUIREMENT_NOT_MET` | Feature not available in current tier | 403 |
| `MOBICA_NOT_CONFIGURED` | SMS service not configured | 503 |

## Testing

### Test Scenarios:
1. ✅ NORMAL user sends 15 SMS (reaches limit)
2. ✅ NORMAL user purchases addon package
3. ✅ NORMAL user sends SMS using addon (addon decrements)
4. ✅ Monthly counter resets on new month
5. ✅ FREE user cannot send SMS
6. ✅ PRO user has unlimited SMS

### Test Endpoints:
```bash
# Check limit status
curl -X GET http://localhost:3000/api/v1/sms/limit-status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Purchase package
curl -X POST http://localhost:3000/api/v1/sms/purchase-package \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payment_method": "test"}'

# View packages
curl -X GET http://localhost:3000/api/v1/sms/packages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Notes

- SMS packages are **non-refundable**
- Addon SMS **never expire** (unlike monthly allowance)
- Package purchases are logged in `sp_sms_packages` table
- Payment integration is placeholder (needs Stripe/PayPal integration)
- FREE tier users are blocked by trial system, not SMS limits

## Future Enhancements

1. **Payment Integration**: Connect to Stripe/PayPal for real payments
2. **Package Variations**: Offer different package sizes (30 SMS, 50 SMS, etc.)
3. **Auto-renewal**: Option to auto-purchase when limit reached
4. **Notifications**: Alert users when approaching limit (e.g., 2 SMS remaining)
5. **Analytics**: Track SMS conversion rates and ROI
6. **Bulk Discounts**: Offer discounts for larger packages
