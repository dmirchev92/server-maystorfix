# VIP Feature Audit Report

**Generated:** December 8, 2025  
**Status:** Feature is ENABLED (`VIP_ENABLED=true`, `VIP_TEST_MODE=true`)

---

## 1. Architecture Overview

### 1.1 VIP Types
- **HOMEPAGE_VIP**: Appears on homepage, global (no city filter), 3 slots per category
- **SEARCH_VIP**: Appears in search results, per category+city, 3 slots per combo

### 1.2 Auction Timing
- **Auction Window**: Sunday 00:00 - 21:59:59 (BG time)
- **Settlement Window**: Sunday 22:00 - 23:59:59 (processing)
- **Coverage Period**: Monday 00:00 - Sunday 23:59:59 (7 days)
- **TEST MODE**: Currently `VIP_TEST_MODE=true` - auction is ALWAYS OPEN

### 1.3 Pricing
| VIP Type | Start Bid | Buyout |
|----------|-----------|--------|
| Homepage VIP | 50 points | 120 points |
| Search VIP | 25 points | 100 points |

---

## 2. Backend Files

### 2.1 VipService.ts
**Location:** `/var/www/servicetextpro/backend/src/services/VipService.ts`

**Key Methods:**
- `isVipEnabled()` - Checks `VIP_ENABLED` env var
- `isAuctionOpen()` - Returns true if Sunday 00:00-22:00 OR `VIP_TEST_MODE=true`
- `getConfig()` - Returns VIP configuration for frontend
- `getOverview(userId)` - SP's current VIP placements
- `getAuctions(userId)` - Available auctions for SP
- `placeBid(userId, vipType, categoryId, pointsIncrement)` - Place/increase bid
- `buyout(userId, vipType, categoryId)` - Immediate buyout with point deduction
- `cancelBid(userId, bidId)` - Cancel an open bid
- `getLeaderboard(userId, vipType, categoryId, city)` - Current auction rankings
- `getHomepageVipProviders(categoryId?)` - Get VIP providers for homepage
- `getSearchVipProviders(categoryId, city)` - Get VIP providers for search
- `settleAuctions()` - Process winners at settlement time

### 2.2 vipController.ts
**Location:** `/var/www/servicetextpro/backend/src/controllers/vipController.ts`

**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/vip/config` | Public | Get VIP configuration |
| GET | `/api/v1/vip/overview` | Required | SP's VIP status |
| GET | `/api/v1/vip/auctions` | Required | Available auctions for SP |
| POST | `/api/v1/vip/bid` | Required | Place/increase bid |
| POST | `/api/v1/vip/buyout` | Required | Buyout a slot |
| DELETE | `/api/v1/vip/bid/:bidId` | Required | Cancel a bid |
| GET | `/api/v1/vip/leaderboard` | Required | Auction rankings |
| POST | `/api/v1/vip/settle` | Admin Key | Trigger settlement (scheduler) |

### 2.3 marketplaceController.ts
**Location:** `/var/www/servicetextpro/backend/src/controllers/marketplaceController.ts`

**VIP Integration:**
- `searchProviders()` - Returns `vipProviders` array alongside regular providers
- `getVipHomepageProviders()` - Endpoint at `/api/v1/marketplace/providers/vip-homepage`

### 2.4 server.ts Routes
```
/api/v1/vip/* - VIP controller
/api/v1/marketplace/providers/vip-homepage - Homepage VIP providers
```

---

## 3. Database

### 3.1 Table: `sp_premium_bids`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | text | NO | Primary key |
| user_id | text | NO | FK to users |
| service_category | text | NO | Category ID (e.g., 'cat_electrician') |
| city | text | NO | City or 'GLOBAL' for homepage VIP |
| neighborhood | text | YES | Not used for VIP |
| bid_amount | numeric | NO | Points bid |
| currency | text | NO | 'HOMEPAGE_VIP' or 'SEARCH_VIP' |
| status | text | NO | 'open', 'won', 'lost', 'buyout', 'cancelled' |
| priority_score | integer | NO | Same as bid_amount for ranking |
| started_at | timestamp | NO | Auction start time |
| expires_at | timestamp | YES | Coverage end time |
| created_at | timestamp | YES | - |
| updated_at | timestamp | YES | - |

### 3.2 Current Data
- **1 buyout bid** exists in the system (status: 'buyout')

---

## 4. Web Frontend (Marketplace)

### 4.1 VIP Provider Page
**Location:** `/var/www/servicetextpro/Marketplace/src/app/provider/vip/page.tsx`

**Features:**
- Shows VIP configuration (prices, timing)
- Displays current placements
- Lists available auctions
- Bid modal with quick-bid buttons (+5, +10, +25, +50)
- Buyout button with confirmation
- Leaderboard modal

**Auth Check:** Redirects to `/auth/login` if not authenticated, redirects to `/` if not service_provider

### 4.2 VipProvidersSection Component
**Location:** `/var/www/servicetextpro/Marketplace/src/components/VipProvidersSection.tsx`

**Usage:** Homepage (`/`)
- Fetches VIP providers via `apiClient.getVipHomepageProviders()`
- Displays up to 6 VIP providers in a grid
- Links to provider profile pages
- Shows "VIP • Платена видимост" badge

### 4.3 Search Page VIP Integration
**Location:** `/var/www/servicetextpro/Marketplace/src/app/search/page.tsx`

**Features:**
- Receives `vipProviders` from `searchProviders()` API
- Displays VIP section at top of results with gold border
- Shows "👑 VIP Специалисти" header

### 4.4 API Client VIP Methods
**Location:** `/var/www/servicetextpro/Marketplace/src/lib/api.ts`

```typescript
getVipConfig()
getVipOverview()
getVipAuctions(filters?)
placeVipBid(vipType, categoryId, pointsIncrement)
buyoutVipSlot(vipType, categoryId)
cancelVipBid(bidId)
getVipLeaderboard(vipType, categoryId, city?)
getVipHomepageProviders(categoryId?)
```

---

## 5. Mobile App

### 5.1 VipVisibilityScreen
**Location:** `/var/www/servicetextpro/mobile-app/src/screens/VipVisibilityScreen.tsx`

**Features:**
- Full-featured VIP management for SPs
- Points balance display
- Auction status (open/closed)
- Current placements list
- Available auctions with bid/buyout
- Bid modal with quick-bid buttons
- Leaderboard modal

**Navigation:** Accessed from ModernDashboardScreen → "👑 VIP" button

### 5.2 ModernDashboardScreen Integration
**Location:** `/var/www/servicetextpro/mobile-app/src/screens/ModernDashboardScreen.tsx`

**VIP Access:**
```tsx
<TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('VipVisibility')}>
  <Text style={styles.navIcon}>👑</Text>
  <Text style={styles.navLabel}>VIP</Text>
</TouchableOpacity>
```

### 5.3 CustomerDashboardScreen Integration
**Location:** `/var/www/servicetextpro/mobile-app/src/screens/CustomerDashboardScreen.tsx`

**Features:**
- Fetches VIP providers for homepage display
- Shows horizontal scroll of VIP providers
- Gold-themed cards with VIP badge

### 5.4 SearchScreen Integration
**Location:** `/var/www/servicetextpro/mobile-app/src/screens/SearchScreen.tsx`

- Receives VIP providers from search API
- Displays VIP section at top

### 5.5 ApiService VIP Methods
**Location:** `/var/www/servicetextpro/mobile-app/src/services/ApiService.ts`

```typescript
getVipConfig()
getVipOverview()
getVipAuctions(filters?)
placeVipBid(vipType, categoryId, pointsIncrement)
buyoutVipSlot(vipType, categoryId)
cancelVipBid(bidId)
getVipLeaderboard(vipType, categoryId, city?)
getVipHomepageProviders(categoryId?)
```

### 5.6 Navigation
**Location:** `/var/www/servicetextpro/mobile-app/src/navigation/AppNavigator.tsx`

```tsx
<Tab.Screen
  name="VipVisibility"
  component={VipVisibilityScreen}
  options={{ tabBarButton: () => null }} // Hidden from tab bar
/>
```

---

## 6. POTENTIAL BUGS & ISSUES

### 6.1 ✅ FIXED: No VIP Link in Web Navigation
**Issue:** The web navigation (`Navigation.tsx`) did NOT include a link to `/provider/vip`.  
**Impact:** Service providers could not easily find the VIP page on web.  
**Location:** `/var/www/servicetextpro/Marketplace/src/components/ui/Navigation.tsx`

**Fix Applied:** Added VIP link to provider navigation items (line 51).

### 6.2 ✅ FIXED: No VIP Link in Provider Dashboard
**Issue:** The provider dashboard page (`/provider/dashboard`) had no card/link to access VIP.  
**Impact:** Web SPs had no way to navigate to VIP management.  
**Location:** `/var/www/servicetextpro/Marketplace/src/app/provider/dashboard/page.tsx`

**Fix Applied:** Added VIP quick action card with gold styling (lines 428-439).

### 6.3 🟡 MEDIUM: Category ID Mismatch Handling
**Issue:** VipService has logic to handle both `cat_electrician` and `electrician` formats.  
**Potential Bug:** If profiles use one format and bids use another, matching may fail.  
**Location:** `/var/www/servicetextpro/backend/src/services/VipService.ts` lines 419-421, 1167-1171

**Current Mitigation:** Code handles both formats, but should be verified.

### 6.4 ✅ FIXED: VIP Settlement Scheduler Not Verified
**Issue:** The `settleAuctions()` method existed but no scheduler/cron job was found to call it.  
**Impact:** Auction winners may not have been processed automatically at Sunday 22:00.  
**Location:** Settlement endpoint at `/api/v1/vip/settle`

**Fix Applied:**
- Created `/var/www/servicetextpro/backend/scripts/vip-settlement-cron.sh`
- Added `SCHEDULER_KEY` to `.env`
- Configured cron job: `0 22 * * 0` (Every Sunday at 22:00)

### 6.5 🟢 LOW: VIP_TEST_MODE is Enabled
**Issue:** `VIP_TEST_MODE=true` means auctions are ALWAYS open, not just Sunday.  
**Impact:** This is intentional for testing but should be disabled in production.  
**Location:** `/var/www/servicetextpro/backend/.env`

### 6.6 🟢 LOW: Leaderboard Only Shows During Auction
**Issue:** Leaderboard returns empty when auction is closed (by design).  
**User Experience:** May confuse users who expect to see results.

### 6.7 🟢 INFO: VIP Feature is Working
- VIP_ENABLED=true ✅
- Database table exists ✅
- 1 buyout bid exists in system ✅
- API endpoints registered ✅
- Mobile integration complete ✅
- Web homepage integration complete ✅
- Web search integration complete ✅

---

## 7. Recommendations

### 7.1 Immediate Fixes - ✅ ALL COMPLETED
1. ✅ **Add VIP link to web navigation** - Added to Navigation.tsx
2. ✅ **Add VIP card to provider dashboard** - Added gold-styled VIP card
3. ✅ **Settlement cron job** - Created script + configured cron for Sunday 22:00

### 7.2 Before Production
1. Set `VIP_TEST_MODE=false` in production
2. Test full auction cycle (place bids, settlement, coverage display)
3. Verify notifications for auction events

### 7.3 Future Enhancements
- Add VIP analytics (views, clicks, conversions)
- Add outbid notifications (push/in-app)
- Add auction reminder notifications

---

## 8. File Summary

| Component | File | Status |
|-----------|------|--------|
| Backend Service | `backend/src/services/VipService.ts` | ✅ Complete |
| Backend Controller | `backend/src/controllers/vipController.ts` | ✅ Complete |
| Backend Marketplace | `backend/src/controllers/marketplaceController.ts` | ✅ VIP integrated |
| Web VIP Page | `Marketplace/src/app/provider/vip/page.tsx` | ✅ Complete |
| Web VIP Section | `Marketplace/src/components/VipProvidersSection.tsx` | ✅ Complete |
| Web Search Page | `Marketplace/src/app/search/page.tsx` | ✅ VIP integrated |
| Web Navigation | `Marketplace/src/components/ui/Navigation.tsx` | ❌ Missing VIP link |
| Web Provider Dashboard | `Marketplace/src/app/provider/dashboard/page.tsx` | ❌ Missing VIP card |
| Web API Client | `Marketplace/src/lib/api.ts` | ✅ VIP methods present |
| Mobile VIP Screen | `mobile-app/src/screens/VipVisibilityScreen.tsx` | ✅ Complete |
| Mobile Dashboard | `mobile-app/src/screens/ModernDashboardScreen.tsx` | ✅ VIP button present |
| Mobile Customer | `mobile-app/src/screens/CustomerDashboardScreen.tsx` | ✅ VIP section present |
| Mobile Search | `mobile-app/src/screens/SearchScreen.tsx` | ✅ VIP integrated |
| Mobile API Service | `mobile-app/src/services/ApiService.ts` | ✅ VIP methods present |
| Mobile Navigation | `mobile-app/src/navigation/AppNavigator.tsx` | ✅ VipVisibility registered |
| Database | `sp_premium_bids` table | ✅ Exists with data |

---

**End of Audit Report**
