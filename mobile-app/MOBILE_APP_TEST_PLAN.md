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
