# SnapFix Mobile App - Test Plan

## 1. Authentication
- Login with valid/invalid credentials
- Registration with all fields
- Password reset flow
- Change password
- Token persistence

## 2. Provider Dashboard
- Load user data and stats
- Location tracking toggle (off/always/schedule)
- Auto SMS toggle with call detection
- Free inspection toggle
- Navigate to all screens

## 3. Customer Dashboard
- Load dashboard
- Navigate to Create Case, My Cases, Search, Chat

## 4. Cases Module
- Provider: Load available/assigned/declined cases
- Provider: Accept, decline, undecline, complete cases
- Provider: Filter by category/city/budget
- Provider: Place bid on case
- Customer: View cases, respond to counter-offers
- Customer: Send to marketplace, cancel case
- Create Case: All fields, location auto-detect, image upload

## 5. Bidding Module
- My Bids: Load and filter bids
- Case Bids: View bids, select winner
- Place Bid: Enter amount, comment, submit

## 6. Chat Module
- Load conversations list
- Real-time message updates via Socket.IO
- Send/receive messages
- Mark as read
- Create new conversation

## 7. Search & Map
- Search: Filter by category/city/neighborhood
- Search: VIP providers highlighted
- Map: Load markers, clustering
- Map: Filter by radius/category
- Map: Free inspection filter

## 8. Subscription & Points
- View subscription tiers
- View points balance and history
- Buy points packages

## 9. VIP Visibility
- View VIP placements and auctions
- Place bid on auction
- Buyout VIP slot

## 10. SMS Settings
- Toggle SMS enabled
- Select template (Latin/Bulgarian/Custom)
- Filter known contacts
- Real-time sync with web

## 11. Statistics
- Load SMS and case statistics
- Filter by month
- Reorder stat boxes
- View reviews

## 12. Referral
- View referral code and link
- Copy/share link
- View referred users and rewards

## 13. Profile & Settings
- Edit profile (all fields)
- Upload profile image
- Auto-detect location
- Delete account
- Settings navigation
- Logout

## 14. Notifications
- Load notifications
- Mark as read
- Notification settings toggles

## 15. Services
- ApiService: Auth token, requests
- SocketIOService: Real-time events
- SMSService: Config sync, send SMS
- LocationTrackingService: GPS tracking
- ModernCallDetectionService: Missed call detection

## 16. Components
- BidModal, UnifiedCaseModal, SurveyModal
- JobAlertModal, PointsBalanceWidget
- AppVersionCheck

## 17. Edge Cases
- No internet, API timeout
- Session expired
- Empty lists
- App backgrounded/killed

---

## Launch Mode Changes (Jan 2026)

### Points System Fix - FREE Access for Free Tier

**Date:** Jan 27, 2026

**Problem:** Free tier users getting "low on points" / "tier does not support this budget range" errors even though Launch Mode set all `points_cost_*` to 0.

**Root Cause:** In `backend/src/services/PointsService.ts`, the `checkCaseAccess` method treated `pointsRequired === 0` as "tier doesn't support this budget range" instead of "free access".

**Fix Applied:**
```typescript
// File: backend/src/services/PointsService.ts
// Lines ~224-233

// BEFORE (blocking when cost is 0):
if (pointsRequired === 0) {
  return {
    allowed: false,
    points_required: 0,
    points_balance: points_balance || 0,
    message: `Your tier does not support cases in this budget range. Please upgrade.`,
    case_budget_range: this.getBudgetRange(case_budget)
  };
}

// AFTER (free access when cost is 0):
if (pointsRequired === 0) {
  return {
    allowed: true,
    points_required: 0,
    points_balance: points_balance || 0,
    message: 'Free access',
    case_budget_range: this.getBudgetRange(case_budget)
  };
}
```

**How to Revert:**
Change `allowed: true` back to `allowed: false` and restore the original message when you want to enforce points costs again.

**Database State (subscription_tiers WHERE id='free'):**
- All `points_cost_*` fields = 0 (meaning free)
- `monthly_sms_limit` = 50
- `max_case_budget` = 999999
- `max_gallery_photos` = 20

---

### Phone Abuse Prevention Re-enabled (Feb 2026)

**Date:** Feb 9, 2026

**Problem/Reason:** During Launch Mode, phone-based abuse prevention was disabled for testing. Re-enabled to prevent same phone number registering multiple free SP accounts.

**File:** `backend/src/services/AuthService.ts` lines ~171-195

**Change:** Uncommented the phone duplicate check block for free-tier tradespeople. IP-based check and SMS verification remain disabled.

**What it does:** If a phone number is already used by an existing free-tier tradesperson account, registration is rejected with error `FREE_ACCOUNT_PHONE_LIMIT`.

**How to Revert:** Comment out lines 171-195 in AuthService.ts (the `if (isFreeTrialUser) { ... phone check ... }` block).

---

### Beta Registration Page (Feb 2026)

**Date:** Feb 9, 2026

**Problem/Reason:** The `/beta` page only collected emails for Google Play Console. Upgraded to a full registration page that creates real user accounts (SP or Customer) + adds to beta testers.

**Files Modified:**
- `beta-tester-automation/server.js` — New `/api/submit-register` endpoint, fixed `awardBetaReferralPoints`, added rate limiting, service categories, cities proxy
- `beta-tester-automation/public/index.html` — Full registration form with role selection, validation, success screens for Gmail vs non-Gmail
- Database: `beta_testers` table — Added `user_id TEXT`, `is_gmail BOOLEAN` columns

**Key Behavior:**
- Gmail users → added to Google Play Console via Playwright (background)
- Non-Gmail users → shown direct APK download link
- Referral: SP referrer gets 5 pts for any referral; referred SP also gets 5 pts; customers don't earn points
- Existing users (USER_ALREADY_EXISTS) → fall back to email-only beta add + show download

**How to Revert:** The beta page is temporary. When beta period ends, the `/beta` route can be removed from nginx and the beta-tester-automation PM2 process stopped.

---

## Free Tier Testing Period (March 2026)

### Full Premium Access for Free Tier Users

**Date Started:** March 16, 2026

**Duration:** Flexible - ends when decided by admin

**Purpose:** Attract users and allow comprehensive app testing by enabling all premium features for Free tier users.

**Communication:** Via social media (handled by admin)

### Database Changes (subscription_tiers WHERE id='free')

**Original Values (SAVED FOR ROLLBACK):**
```json
{
  "max_case_budget": 250,
  "points_monthly": 15,
  "points_yearly_included": 0,
  "monthly_sms_limit": 0,
  "sms_points_cost": undefined,
  "extra_points_price": null,
  "max_service_categories": 2,
  "max_gallery_photos": 5,
  "monthly_case_responses": 5,
  "premium_badge": false,
  "featured_listing": false,
  "bidding_enabled": undefined,
  "max_certificates": 2
}
```

**Testing Period Values:**
```json
{
  "max_case_budget": 10000,
  "points_monthly": 1000,
  "points_yearly_included": 2000,
  "monthly_sms_limit": 50,
  "sms_points_cost": 0,
  "extra_points_price": 0.10,
  "max_service_categories": 999,
  "max_gallery_photos": 100,
  "monthly_case_responses": 999,
  "premium_badge": true,
  "featured_listing": true,
  "bidding_enabled": true,
  "max_certificates": 10
}
```

### Features Enabled for Free Tier

1. **Case Access:** All budget ranges up to 10,000 EUR (0 points cost)
2. **SMS:** 50 SMS/month, 0 points per SMS
3. **Points:** 1000 points/month, 2000 points/year included
4. **VIP:** Can participate in VIP auctions and buyouts
5. **Bidding:** Full bidding system access
6. **Map Visibility:** Premium badge, featured listing
7. **Gallery:** Up to 100 photos (vs 5 originally)
8. **Categories:** Unlimited service categories (vs 2 originally)
9. **Points Purchase:** Can buy additional points at 0.10 EUR/point
10. **Chat:** Unlimited messages and conversations

### Metrics Tracking

**User Registrations:**
- Total Free tier users
- Daily/weekly registration trends
- See: `/var/www/servicetextpro/backend/metrics-free-tier-testing.sql`

**SMS Usage Per User:**
- Total SMS sent per user
- Daily SMS usage per user
- Active days tracking
- See: `/var/www/servicetextpro/backend/metrics-free-tier-testing.sql`

### Files Created

1. **Backup:** `/var/www/servicetextpro/backend/backup-free-tier-before-testing.sql`
2. **Enable Script:** `/var/www/servicetextpro/backend/enable-free-tier-testing.sql`
3. **Rollback Script:** `/var/www/servicetextpro/backend/rollback-free-tier-testing.sql`
4. **Metrics Queries:** `/var/www/servicetextpro/backend/metrics-free-tier-testing.sql`
5. **Backup Table:** `subscription_tiers_backup_testing_2026_03_16`

### How to Revert (When Testing Period Ends)

**Step 1: Notify Users**
- Give 1-week advance notice via social media
- Explain testing period is ending
- Offer upgrade discounts (e.g., 20% off first month)

**Step 2: Run Rollback Script**
```bash
cd /var/www/servicetextpro/backend
psql -U postgres -d servicetext_pro -f rollback-free-tier-testing.sql
```

**Step 3: Verify Rollback**
```sql
SELECT id, name, limits FROM subscription_tiers WHERE id = 'free';
```

**Step 4: No Code Changes Needed**
- Backend logic automatically handles tier limits
- No PM2 restart required
- Changes take effect immediately

### Testing Scenarios Completed

1. ✅ SMS Functionality - 0 points cost, 50/day limit
2. ✅ Budget Cases - All ranges 1-10,000 EUR accessible
3. ✅ Map Visibility - Premium badge, featured listing
4. ✅ VIP Purchase - Auction participation enabled
5. ✅ Points Add-ons - Can purchase at 0.10 EUR/point
6. ✅ Points Tracking - All transactions logged
7. ✅ Chat - Unlimited access

### Rollback Considerations

**User Impact:**
- Users will lose premium features
- Cases above 250 EUR will be blocked
- SMS will be disabled (0 limit)
- Points costs will apply

**Mitigation:**
- Offer upgrade discounts
- Preserve earned data (profiles, reviews, referrals)
- Clear communication about value received
- Show comparison of Free vs Paid tiers

### Database State

**Backup Location:** `subscription_tiers_backup_testing_2026_03_16` table

**Rollback Ready:** Yes - script tested and verified

**No Code Changes:** All changes are database-only, backend logic handles limits automatically
