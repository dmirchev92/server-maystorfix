# Launch Mode - SP Onboarding Phase

## Overview

Launch Mode is a temporary configuration that allows Service Providers (SPs) to register and use the platform with full access before customers arrive. This enables SPs to:

1. **Use 50 free SMS** as the main feature for marketing
2. **Earn referral points** by inviting other SPs
3. **Build their profile** (gallery, reviews, certificates) without restrictions
4. **Accept cases for free** (0 points cost for all budget ranges)

## Current Status

**LAUNCH_MODE: ENABLED** (as of January 2026)

---

## Configuration Details

### Environment Variable
```
# File: /var/www/servicetextpro/backend/.env
LAUNCH_MODE=true
```

### Database Changes (subscription_tiers WHERE id='free')

| Setting | Original Value | Launch Mode Value |
|---------|----------------|-------------------|
| `monthly_sms_limit` | 0 | **50** |
| `max_case_budget` | 500 | **999999** |
| `max_gallery_photos` | 5 | **20** |
| `max_certificates` | 2 | **10** |
| `max_service_categories` | 2 | **5** |
| `monthly_case_responses` | 10 | **999** |
| `sms_points_cost` | 2 | **0** |
| All `points_cost_*` | 0 | **0** |

### Backend Changes

**File: `/var/www/servicetextpro/backend/src/controllers/caseController.ts`**

In `getCasesWithFilters()`, hardcoded budget restrictions by tier were blocking free/normal users from seeing higher-budget cases. Fixed to skip budget restrictions when:
- `LAUNCH_MODE=true` (all users see all budgets)
- Customer is viewing their own cases (should always see own cases regardless of tier)

```typescript
const LAUNCH_MODE = process.env.LAUNCH_MODE === 'true';
const isCustomerViewingOwnCases = !!customerId;

if (requestingUserId && !isCustomerViewingOwnCases && !LAUNCH_MODE) {
  // ... apply tier budget restrictions only for SP browsing available cases
}
```

**How to revert:** Remove the `!LAUNCH_MODE` check from the condition. The `!isCustomerViewingOwnCases` check should remain permanently — customers should always see their own cases.

---

**File: `/var/www/servicetextpro/backend/src/services/TrialService.ts`**

Added `LAUNCH_MODE` check at the start of `checkTrialStatus()`:
```typescript
const LAUNCH_MODE = process.env.LAUNCH_MODE === 'true';

// In checkTrialStatus():
if (LAUNCH_MODE) {
  return {
    isActive: true,
    isExpired: false,
    casesUsed: 0,
    casesRemaining: Infinity,
    daysRemaining: Infinity,
    expiresAt: null,
    reason: 'not_free_tier'
  };
}
```

### Mobile App Changes

**File: `/var/www/servicetextpro/mobile-app/src/screens/AuthScreen.tsx`**

- Registration shows only "🎁 Безплатен (Промо)" with green "LAUNCH" badge
- Tier selection modal is disabled
- Shows promotional message: "🚀 Специална оферта: 50 безплатни SMS + пълен достъп до всички функции!"

---

## How to Disable Launch Mode (When Customers Arrive)

### Step 1: Disable Environment Variable

```bash
# Edit the .env file
nano /var/www/servicetextpro/backend/.env

# Change:
LAUNCH_MODE=false
```

### Step 2: Restore Original Free Tier Limits

```bash
# Run the revert SQL script
PGPASSWORD='C58acfd5c!' psql -U postgres -d servicetext_pro -f /var/www/servicetextpro/backend/migrations/launch_mode_revert.sql
```

Or manually run:
```sql
UPDATE subscription_tiers 
SET limits = '{
  "premium_badge": false,
  "points_monthly": 15,
  "search_ranking": "standard",
  "max_case_budget": 500,
  "sms_points_cost": 2,
  "analytics_access": false,
  "featured_listing": false,
  "max_certificates": 2,
  "priority_support": false,
  "monthly_sms_limit": 0,
  "points_cost_1_250": 0,
  "extra_points_price": null,
  "max_gallery_photos": 5,
  "points_cost_250_500": 0,
  "points_cost_500_750": 0,
  "points_cost_750_1000": 0,
  "points_cost_1000_1500": 0,
  "points_cost_1500_2000": 0,
  "points_cost_2000_3000": 0,
  "points_cost_3000_4000": 0,
  "points_cost_4000_5000": 0,
  "points_cost_5000_7500": 0,
  "max_service_categories": 2,
  "monthly_case_responses": 10,
  "points_cost_7500_10000": 0,
  "points_yearly_included": 0
}'::jsonb
WHERE id = 'free';
```

### Step 3: Restore Mobile App Tier Selection

In `/var/www/servicetextpro/mobile-app/src/screens/AuthScreen.tsx`, restore the original tier selection UI:

```tsx
{/* Tier Selection */}
<View style={styles.tierSelectionContainer}>
  <Text style={styles.fieldLabel}>Избран план</Text>
  <TouchableOpacity
    style={styles.tierDisplayBox}
    onPress={() => setShowTierModal(true)}
  >
    <View style={styles.tierInfo}>
      <Text style={styles.tierName}>
        {selectedTier === 'free' && '🆓 Безплатен'}
        {selectedTier === 'normal' && '⭐ Нормален'}
        {selectedTier === 'pro' && '👑 Професионален'}
      </Text>
      <Text style={styles.tierPrice}>
        {selectedTier === 'free' && '0 €'}
        {selectedTier === 'normal' && '179 €/година (с ДДС)'}
        {selectedTier === 'pro' && '249 €/година (с ДДС)'}
      </Text>
    </View>
    <Text style={styles.tierChangeText}>Промени ▸</Text>
  </TouchableOpacity>
  <Text style={styles.tierHint}>💡 Можете да промените плана си по всяко време</Text>
</View>
```

### Step 4: Rebuild and Restart

```bash
# Rebuild backend
cd /var/www/servicetextpro/backend && npm run build

# Restart services
sudo pm2 restart all
# Password: C58acfd5c!
```

### Step 5: Rebuild Mobile App

After updating AuthScreen.tsx, rebuild the mobile app on the local machine.

---

## Migrating Existing Free Users

When disabling Launch Mode, existing free users will keep:
- ✅ User profile & business info
- ✅ Gallery photos
- ✅ Reviews & ratings
- ✅ Referral points earned
- ✅ Cases completed
- ✅ Chat history

### Migration Options

**Option A: Auto-upgrade to Normal tier**
```sql
-- Upgrade all free SPs to Normal tier
UPDATE users 
SET subscription_tier_id = 'normal',
    subscription_status = 'active'
WHERE subscription_tier_id = 'free' 
  AND role = 'tradesperson';
```

**Option B: Keep as free with original limits**
- Users keep their data but lose enhanced limits
- They can upgrade manually when ready

---

## Files Modified

| File | Change |
|------|--------|
| `/var/www/servicetextpro/backend/.env` | Added `LAUNCH_MODE=true` |
| `/var/www/servicetextpro/backend/src/services/TrialService.ts` | Skip trial checks in launch mode |
| `/var/www/servicetextpro/mobile-app/src/screens/AuthScreen.tsx` | Show only free tier with promo badge |
| `/var/www/servicetextpro/backend/migrations/launch_mode_revert.sql` | SQL to restore original free tier |

---

## Quick Reference Commands

### Check current free tier limits
```bash
PGPASSWORD='C58acfd5c!' psql -U postgres -d servicetext_pro -c "SELECT limits FROM subscription_tiers WHERE id = 'free';"
```

### Check if launch mode is enabled
```bash
grep "LAUNCH_MODE" /var/www/servicetextpro/backend/.env
```

### View backend logs for launch mode
```bash
sudo pm2 logs servicetextpro-backend --lines 50 | grep -i "launch"
```

---

## Contact

For questions about Launch Mode, refer to the memory system or this document.

**Created:** January 21, 2026
**Last Updated:** January 21, 2026
