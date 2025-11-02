# SMS Limits System - Complete Summary

## Tier Structure

| Tier | Monthly SMS | Can Purchase Addons? | Addon Price |
|------|-------------|---------------------|-------------|
| **FREE** | 0 | ❌ No | - |
| **NORMAL** | 15 | ✅ Yes | 15 SMS for 40 BGN |
| **PRO** | 25 | ✅ Yes | 15 SMS for 40 BGN |

---

## How It Works

### Two Separate Counters

#### 1. Monthly Subscription Balance (Auto-Renewable)
- **NORMAL**: 15 SMS per month
- **PRO**: 25 SMS per month
- **Resets**: Automatically on the 1st of every month
- **Tracked in**: `sms_settings.monthly_sms_count`

#### 2. Addon Balance (Purchased SMS - Never Expires)
- **Price**: 15 SMS for 40 BGN
- **Available for**: NORMAL and PRO tiers
- **Carries over**: Forever until used
- **Tracked in**: `sms_settings.addon_sms_remaining`

---

## Usage Priority

When sending an SMS:
1. **Addon SMS used FIRST** (if available)
2. **Monthly allowance used SECOND** (when addons = 0)

---

## Example Scenarios

### Scenario 1: NORMAL User (15 SMS/month)

**November:**
```
Monthly: 15/15 used (0 remaining)     ← All used up
Addon: 0                               ← No addons
Total: 0 SMS available                 ← Can't send

👉 Purchases 15 SMS addon for 40 BGN

Monthly: 15/15 used (0 remaining)     ← Still used up
Addon: 15                              ← NEW! Purchased
Total: 15 SMS available                ← Can send again
```

**December 1st (Month Renews):**
```
Monthly: 0/15 used (15 remaining)     ← AUTO-RESET! ✨
Addon: 15                              ← STILL THERE! Carries over
Total: 30 SMS available                ← 15 + 15 = 30!
```

---

### Scenario 2: PRO User (25 SMS/month)

**November:**
```
Monthly: 20/25 used (5 remaining)     ← 5 left
Addon: 0                               ← No addons
Total: 5 SMS available

👉 Purchases 15 SMS addon for 40 BGN

Monthly: 20/25 used (5 remaining)     ← Unchanged
Addon: 15                              ← Added
Total: 20 SMS available                ← 5 + 15 = 20
```

**Sends 10 SMS:**
```
Uses addon first:
Addon: 15 → 5 (used 10)
Monthly: 20/25 (still 5 remaining)
Total: 10 SMS available (5 addon + 5 monthly)
```

**December 1st:**
```
Monthly: 0/25 used (25 remaining)     ← RESET to 25
Addon: 5                               ← Carried over
Total: 30 SMS available                ← 25 + 5 = 30
```

---

### Scenario 3: Multiple Purchases

**User buys multiple addon packages:**

**November:**
- Uses 15 monthly → Buys 15 addon
- Monthly: 15/15, Addon: 15

**December:**
- Uses 10 monthly → Buys another 15 addon
- Monthly: 10/15, Addon: 15 + 15 - 0 = 30

**January 1st:**
```
Monthly: 0/15 (15 remaining)          ← Reset
Addon: 30                              ← All addons carried over
Total: 45 SMS available!               ← 15 + 30
```

---

## Database Structure

### `sms_settings` table:
```sql
monthly_sms_count: 8              -- How many used this month (0-15 for NORMAL, 0-25 for PRO)
monthly_period_start: Nov 1       -- When current period started
addon_sms_remaining: 15           -- Purchased SMS balance (accumulates)
```

### `sp_sms_packages` table:
```sql
id: uuid
user_id: uuid
package_type: 'addon_15'
sms_count: 15
price: 40.00
currency: 'BGN'
sms_used: 3
sms_remaining: 12
status: 'active'                  -- active, depleted, expired
purchased_at: timestamp
```

---

## API Endpoints

### Check SMS Limit Status
```bash
GET /api/v1/sms/limit-status

Response:
{
  "canSend": true,
  "monthlyLimit": 15,              # 15 for NORMAL, 25 for PRO
  "monthlyUsed": 8,
  "monthlyRemaining": 7,
  "addonRemaining": 15,
  "totalRemaining": 22,
  "tier": "normal",
  "periodStart": "2025-11-01",
  "periodEnd": "2025-11-30"
}
```

### Purchase SMS Package
```bash
POST /api/v1/sms/purchase-package

Body:
{
  "payment_method": "stripe",
  "payment_reference": "pi_xxx"
}

Response:
{
  "success": true,
  "data": {
    "package": {
      "id": "uuid",
      "smsCount": 15,
      "price": 40.00,
      "currency": "BGN",
      "smsRemaining": 15
    }
  }
}
```

### View Purchase History
```bash
GET /api/v1/sms/packages

Response:
{
  "packages": [
    {
      "id": "uuid",
      "packageType": "addon_15",
      "smsCount": 15,
      "price": 40.00,
      "purchasedAt": "2025-11-15",
      "smsUsed": 3,
      "smsRemaining": 12,
      "status": "active"
    }
  ]
}
```

---

## Key Features

✅ **Two separate counters**: Monthly (renewable) + Addon (permanent)
✅ **Automatic monthly reset**: Monthly allowance resets on 1st of each month
✅ **Addon SMS never expire**: Purchased SMS carry over indefinitely
✅ **Smart usage priority**: Addon SMS used first, then monthly allowance
✅ **Stackable purchases**: Can buy multiple addon packages
✅ **FIFO consumption**: Oldest addon packages consumed first
✅ **Transparent tracking**: Full purchase history available

---

## Migration

Run the migration:
```bash
psql -U your_user -d your_database -f backend/migrations/007_add_sms_limits.sql
```

This will:
- Add `monthly_sms_limit` to tiers (FREE: 0, NORMAL: 15, PRO: 25)
- Create `sp_sms_packages` table
- Add tracking columns to `sms_settings`

---

## Files Modified

1. **`/backend/migrations/007_add_sms_limits.sql`** - Database schema
2. **`/backend/src/services/SMSLimitService.ts`** - Business logic
3. **`/backend/src/controllers/smsController.ts`** - API endpoints
4. **`/backend/src/types/subscription.ts`** - TypeScript types
5. **`/SMS_LIMITS_IMPLEMENTATION.md`** - Full documentation

---

## Benefits

### For Users:
- **Predictable**: Know exactly how many SMS they have
- **Fair**: Purchased SMS never expire
- **Flexible**: Can buy more when needed
- **Transparent**: Clear usage tracking

### For Business:
- **Revenue**: Additional income from addon sales (40 BGN per package)
- **Upsell**: Encourages upgrades (PRO gets 25 vs 15)
- **Retention**: Users invested in addons are less likely to churn
- **Simple**: Easy to understand pricing

---

## Next Steps

### Frontend Integration Needed:
- [ ] Display SMS usage in mobile app settings
- [ ] Show "Purchase More SMS" button when limit reached
- [ ] Implement payment flow (Stripe/PayPal)
- [ ] Display package purchase history
- [ ] Show upgrade prompts (FREE → NORMAL → PRO)

### Future Enhancements:
- [ ] Package variations (30 SMS, 50 SMS, etc.)
- [ ] Bulk discounts
- [ ] Auto-renewal option
- [ ] Low balance notifications
- [ ] SMS analytics dashboard
