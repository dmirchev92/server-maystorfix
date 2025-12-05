# VIP Visibility Feature Plan

Status: **Planning / Spec Only** (no implementation yet)

This document defines the VIP visibility system for ServiceText Pro, reusing existing tables and APIs wherever possible.

---

## 0. Development Guidelines

### 0.1 UI/UX Theme Consistency

- **All new VIP screens and components MUST follow the existing visual theme** of both the mobile app and web marketplace.
- Mobile: Use the same dark gradient background (`#0f172a` → `#1e293b` → `#312e81`), card styles, button styles, and typography as existing screens like `ModernDashboardScreen`, `SearchScreen`, `SubscriptionScreen`.
- Web: Use the same Tailwind classes, color palette, and component patterns as existing pages in `/Marketplace`.
- Do not introduce new design patterns without explicit approval.

### 0.2 Localization

- **All user-facing text in the frontend (mobile app and web) MUST be in Bulgarian.**
- No English strings in UI labels, buttons, messages, alerts, or placeholders.
- Error messages from backend should also be in Bulgarian where they are shown to users.

### 0.3 Backend-Driven Configuration

- **No hardcoded values in the frontend.** All configuration must come from the backend:
  - VIP prices (start bid, buyout) – fetched via API.
  - Auction timing (window start/end, coverage dates) – fetched via API.
  - Category labels (Bulgarian) – fetched via existing `/marketplace/categories` API.
  - VIP slot count (3) – returned by API (allow future changes without app update).
  - Minimum bid increment – returned by API.
- Frontend caches these values but always respects backend as source of truth.
- This ensures web and mobile stay synchronized and changes can be deployed without app store updates.

### 0.4 Feature Flag (Kill Switch)

VIP feature will be controlled by an environment variable for safe rollout:

```bash
# In backend/.env
VIP_ENABLED=true   # Set to false to disable VIP feature entirely
```

**Behavior when `VIP_ENABLED=false`:**
- All `/api/v1/vip/*` endpoints return `{ success: false, error: { code: 'FEATURE_DISABLED' } }`.
- `searchProviders` returns providers normally (no VIP section).
- `/marketplace/providers/vip-homepage` returns empty array.
- Mobile/web VIP sections gracefully hide (no errors).

**This allows instant rollback** if any issues arise in production without code deployment.

### 0.5 Implementation Stages

Implementation will proceed in **two stages**:

1. **Stage 1: Mobile App** (priority)
   - Backend APIs for VIP.
   - Mobile SP screens (VipVisibilityScreen, dashboard card).
   - Mobile customer VIP display (SearchScreen VIP section, homepage VIP strip).

2. **Stage 2: Web Marketplace**
   - Web SP pages (`/provider/vip`).
   - Web customer VIP display (homepage strip, search results VIP section).
   - Must stay synchronized with mobile via shared backend APIs.

---

## 1. Business Goals

- **Increase monetization and engagement** by letting Service Providers (SPs) use points for extra visibility.
- **Keep it fair and predictable** with clear weekly auctions and limited slots.
- **Minimize new infrastructure** by reusing the existing points system and premium tables.

Two VIP products:

- **Homepage VIP** – 3 prominent slots per category on the app/web homepage (global, not city‑specific).
- **Search VIP** – VIP strip on top of search results when a customer filters by category + city.

---

## 2. Final Business Rules (Agreed)

### 2.1 Scope & Slots

- **Homepage VIP**
  - Scope: **per service category**, **global** (no city split).
  - Slots: **3 slots per category**.
  - Only filled slots are shown.

- **Search VIP**
  - Scope: **per service category + city**.
  - Slots: **3 slots per (category, city)**.
  - Only filled slots are shown.

- **Per‑provider limits** (per category, per week):
  - Max **1 Homepage VIP slot**.
  - Max **1 Search VIP slot**.

### 2.2 Time Window (BG Time)

- All times are in **Europe/Sofia** (BG local time).
- **Auction window**:
  - Every **Sunday 00:00:00 – 21:59:59** (22 hours).
  - During this time, SPs can place bids, increase bids, or buyout slots.
- **Settlement window**:
  - **Sunday 22:00:00 – 23:59:59** (2-hour buffer).
  - System processes winners, deducts points, sends notifications.
  - No new bids accepted during this time.
- **VIP coverage week**:
  - **Monday 00:00:00** – **Sunday 23:59:59** (full 7 days).
  - VIP providers are displayed throughout the entire week.
  - Seamless transition: old VIP ends Sunday 23:59:59, new VIP starts Monday 00:00:00.

### 2.2.1 Auction Notifications

- **Reminder notification** sent to all SPs:
  - **Saturday 18:00 BG time**: "Утре започват VIP търговете! Подготви точките си."
  - Links directly to VIP management screen.
- **Auction open notification**:
  - **Sunday 00:00**: "VIP търгът е отворен! Наддавай до 22:00 тази вечер."
- **Outbid notification** (during auction):
  - When SP is outbid: "Някой те измести от VIP слот за {category}. Наддай още?"
- **Last hour reminder**:
  - **Sunday 21:00**: "Остава 1 час до края на VIP търга!"
- **Auction result notification**:
  - **Sunday 22:30** (after settlement): "Спечели VIP слот за {category}!" or "Не спечели – точките не бяха удържани."

### 2.3 Points & Pricing

- **Homepage VIP** (per category):
  - Start bid: **50 points**.
  - Buyout: **120 points**.

- **Search VIP** (per category + city):
  - Start bid: **25 points**.
  - Buyout: **100 points**.

- **Payment rule**:
  - Bids: **"Pay only if you win"** at the end of the auction (no non‑winner charges).
  - Buyout: **points are charged immediately** when SP confirms buyout.
    - UI must show a confirmation dialog: e.g. *"Сигурен ли си? Тези точки ще бъдат удържани веднага."*

### 2.4 Auction Mechanics (per VIP type, category[/city], week)

- 3 slots per scope. Auctions run in parallel per category (Homepage) and per category+city (Search).
- Bidding behavior:
  - Each SP has at most **one bid row per (vipType, category, [city], week)**.
  - `bid_amount` is the **total committed points** for that auction.
  - Minimum bid = start price (50/25).
  - SPs can increase by increments (e.g. +5, +10, +25).
  - We enforce **minimum increment** (>= 5 points) in the service layer.
- Winner selection:
  - For each scope (Homepage / Search + category[/city]):
    - Rank by `bid_amount` (descending).
    - Top **3** are winners, ignoring exhausted/invalid bids.
  - Tie‑breaker: **earlier last‑update timestamp wins**.

### 2.5 Search VIP City Scope for SPs

- For **Search VIP**, the SP bids for their **profile city** (from `service_provider_profiles.city`).
- If SP operates in multiple cities, they can only bid for **one city per category** (their primary profile city).
- Future enhancement: allow multi-city bidding (out of scope for v1).

### 2.6 Bid Cancellation

- **Bids can be cancelled** during the auction window (Sunday 00:00–21:59:59).
- Cancellation removes the bid entirely (row deleted or status set to `'cancelled'`).
- No points are deducted for cancelled bids.
- **Buyouts cannot be cancelled** (points already deducted).

### 2.7 Concurrency & Race Conditions

- **Buyout operations use database transactions with row-level locking**:
  - `SELECT ... FOR UPDATE` on existing bids for that scope/week.
  - Check slot count within transaction.
  - Prevents double-booking of slots.
- **Bid increments** also use transactions to ensure atomic updates.

---

## 3. Data Model (Reusing Existing Tables)

### 3.1 Tables

We reuse **existing** tables, no new tables required.

- **`users`**
  - Fields used: `id`, `points_balance`, `points_total_earned`, `points_total_spent`, subscription fields.

- **`sp_points_transactions`**
  - Used to record **all VIP point movements**.
  - Key columns: `user_id`, `transaction_type`, `points_amount`, `balance_after`, `reason`, `metadata` (JSONB), `created_at`.
  - For VIP we will use `metadata` like:
    - `{ "feature": "vip_homepage", "category": "cat_electrician", "city": null, "week_start": "2025-12-08", "vip_type": "homepage" }`
    - `{ "feature": "vip_search", "category": "cat_electrician", "city": "София", "week_start": "2025-12-08", "vip_type": "search" }`.

- **`service_provider_profiles`**
  - Fields used: `user_id`, `service_category`, `city`, `neighborhood`, `is_premium`, `premium_listing_priority`, `featured_until`, `rating`, `total_reviews`, `profile_image_url`.
  - For VIP visibility itself, we **do not** need to change these fields.
  - Premium flags remain subscription‑driven; VIP is additive on top.

- **`sp_premium_bids`** (to be repurposed for VIP auctions)

  Schema (from DB):

  - `id` (TEXT, PK)
  - `user_id` (TEXT, FK -> users.id)
  - `service_category` (TEXT, NOT NULL)
  - `city` (TEXT, NOT NULL)
  - `neighborhood` (TEXT, NULL)
  - `bid_amount` (NUMERIC, NOT NULL)
  - `currency` (TEXT, NOT NULL)
  - `status` (TEXT, NOT NULL)
  - `priority_score` (INTEGER, NOT NULL)
  - `started_at` (TIMESTAMP, NOT NULL)
  - `expires_at` (TIMESTAMP, NULL)
  - `created_at`, `updated_at` (TIMESTAMP)

  Existing indexes:

  - By `user_id`.
  - By `(service_category, city)`.
  - By `status`.
  - By `priority_score DESC`.

  **VIP usage semantics:**

  - `bid_amount` → **points** (not currency).
  - `currency` → VIP type discriminator:
    - `'HOMEPAGE_VIP'` – homepage auctions.
    - `'SEARCH_VIP'` – search auctions.
  - `service_category` → category ID (from `service_categories.id`).
  - `city`:
    - For **Search VIP**: real city name (e.g. `"София"`).
    - For **Homepage VIP**: special value, e.g. `'GLOBAL'`.
  - `status`:
    - `'open'` – during auction window, bid still active.
    - `'won'` – winner after auction settled.
    - `'lost'` – did not win (or insufficient points at settlement).
    - `'buyout'` – buyout winner, charged immediately.
  - `priority_score`:
    - For VIP: set to `bid_amount` (points) for simple ordering.

### 3.2 VIP Week Scoping

We define a logical **VIP week ID** (not stored as a separate column, but derivable from `started_at` / `expires_at`).

- For each (vipType, service_category, [city], week):
  - There may be multiple bids from different SPs.
  - At most 3 with `status IN ('won','buyout')` and `now()` in `[started_at, expires_at]`.

---

## 4. Auction Lifecycle

### 4.1 Creation & Opening (Cron / Scheduler)

1. **Determine next coverage week**:
   - Compute next Monday 00:00 (week_start) and next Sunday 23:59:59 (week_end).

2. **At Sunday 00:00 (BG time)**:
   - For each **service_category**:
     - Ensure there is an "auction context" for:
       - Homepage VIP: `(vipType='HOMEPAGE_VIP', service_category, city='GLOBAL')`.
     - For each **(service_category, city)** combination where SPs are active (or simply all cities the system supports):
       - Search VIP: `(vipType='SEARCH_VIP', service_category, city)`.
   - We do **not** need to pre‑create rows per SP; rows are created on first bid/buyout.
   - Bids created during this time will use:
     - `started_at`: auction open time (Sunday 00:00).
     - `expires_at`: coverage `week_end`.

3. **Auction window is Sunday 00:00–21:59:59**:
   - During this time (22 hours) SPs can:
     - Place/raise bids.
     - Trigger buyout.

### 4.2 Bidding Rules (Non‑Buyout)

- Endpoint: `POST /api/v1/vip/bid`.
- Input (conceptual):

  ```json
  {
    "vipType": "homepage" | "search",
    "categoryId": "cat_electrician",
    "city": "София"   // required for search, ignored for homepage
    "pointsIncrement": 5
  }
  ```

- Behavior:
  1. Validate **auction is open** (current time within Sunday 00:00–21:59:59 BG; plus correct week context).
  2. Enforce **per‑provider limits**:
     - If provider already has a `sp_premium_bids` row for this week & category & vipType with `status IN ('open','won','buyout')`, reject.
  3. Find existing bid row for this SP + scope + week; if none, create a new one:
     - Initial `bid_amount` must be at least start price (50/25).
  4. New `bid_amount` = `max(current_bid_amount, start_price) + pointsIncrement`.
  5. Check points (soft check):
     - `PointsService.getPointsBalance()` → `current_balance >= new_bid_amount`.
     - If not, return error.
  6. Save / update `sp_premium_bids` row with:
     - `bid_amount = new_bid_amount`.
     - `priority_score = new_bid_amount`.
     - `status = 'open'`.

- **No points are deducted at bid time.**

### 4.3 Buyout Rules (Immediate Charge)

- Endpoint: `POST /api/v1/vip/buyout`.
- Input:

  ```json
  {
    "vipType": "homepage" | "search",
    "categoryId": "cat_electrician",
    "city": "София"   // required for search, ignored or omitted for homepage
  }
  ```

- Behavior:
  1. Validate auction is **open**.
  2. Enforce per‑provider limits (same as bidding).
  3. Determine **buyout price**:
     - Homepage: 120 points.
     - Search: 100 points.
  4. Check if there is a **free slot** for that scope (<=2 existing winners/buyouts for that week & scope).
  5. Check points balance:
     - Use `PointsService.getPointsBalance()`.
     - If `current_balance < buyout_price`, reject.
  6. **Immediately deduct points**:
     - `UPDATE users SET points_balance = points_balance - buyout_price, points_total_spent = points_total_spent + buyout_price`.
     - Insert `sp_points_transactions` row with:
       - `transaction_type = 'spent'`.
       - `points_amount = buyout_price`.
       - `reason = 'VIP homepage buyout ...'` or `'VIP search buyout ...'`.
       - `metadata.feature = 'vip_homepage' | 'vip_search'`, etc.
  7. Upsert into `sp_premium_bids`:
     - `bid_amount = buyout_price`.
     - `priority_score = buyout_price`.
     - `status = 'buyout'`.
     - `started_at = auction_open_time`, `expires_at = week_end`.

- **UI requirement**:
  - Before buyout API call, show confirmation:
    - e.g. *"Сигурен ли си, че искаш да купиш VIP слот? Тези точки ще бъдат удържани веднага."*

### 4.4 Auction Closing & Settlement (Non‑Buyout Winners)

- At **Sunday 22:00 BG time** (settlement window starts):

  1. For each **scope**:
     - Homepage VIP: each `(service_category, city='GLOBAL')`.
     - Search VIP: each `(service_category, city)`.
  2. Collect all bids for that scope & week with `status = 'open'`.
  3. Sort by `bid_amount DESC`, tie‑break by previous `updated_at` (earlier wins).
  4. Starting from top, attempt to allocate up to **remaining slots** (3 - number of buyouts):
     - For each candidate SP:
       - Re‑fetch `points_balance`.
       - If `balance >= bid_amount`:
         - Deduct `bid_amount` once.
         - Insert `sp_points_transactions` row.
         - Mark bid `status = 'won'` and set `expires_at = week_end`.
       - Else:
         - Mark as `status = 'lost'` (reason: insufficient points) and **do not deduct anything**.
  5. All other `open` bids that are not winners become `status = 'lost'`.

- Result:
  - For each scope we end with up to 3 `won`+`buyout` rows, plus any number of `lost` rows.

---

## 5. Surfacing VIP to Customers

### 5.1 Search VIP Integration (`/marketplace/providers/search`)

We extend the **existing** endpoint:

- **Path**: `GET /api/v1/marketplace/providers/search`.
- Already supports filters: `category`, `city`, `neighborhood`, `lat`, `lng`, `radius`, `limit`, `offset`.

**Changes:**

1. **Join active Search VIP winners** when `category` and `city` are present:

   - Left join to `sp_premium_bids` with conditions:
     - `currency = 'SEARCH_VIP'`.
     - `service_category = :category`.
     - `city = :city`.
     - `status IN ('won','buyout')`.
     - `NOW() BETWEEN started_at AND expires_at`.

2. Expose a boolean in the result:

   - e.g. `is_vip_search = (vip.id IS NOT NULL)`.

3. Adjust ordering:

   - VIP providers at top, ordered by `priority_score DESC`.
   - Then normal ranking by rating / reviews / completed projects.

   ```sql
   ORDER BY 
     CASE WHEN vip.id IS NOT NULL THEN 0 ELSE 1 END,
     vip.priority_score DESC NULLS LAST,
     rating DESC NULLS LAST,
     total_reviews DESC,
     completed_projects DESC
   ```

**Frontend behavior (web + mobile):**

- Split result into:
  - `vipProviders = providers.filter(p => p.isVipSearch)`.
  - `regularProviders = providers.filter(p => !p.isVipSearch)`.
- Render on top:
  - Section: "VIP {categoryLabel} в {city}", up to 3 cards.
- Render below:
  - Normal list: "Всички {categoryLabel}".

### 5.2 Homepage VIP Endpoint

We introduce a **new minimal endpoint** for homepage VIP.

- **Path**: `GET /api/v1/marketplace/providers/vip-homepage`.
- Query params:
  - Optional `limitPerCategory` (default 3).

**Behavior:**

- For each `service_categories` row:
  - Find `sp_premium_bids` rows where:
    - `currency = 'HOMEPAGE_VIP'`.
    - `service_category = category.id`.
    - `city = 'GLOBAL'`.
    - `status IN ('won','buyout')`.
    - `NOW() BETWEEN started_at AND expires_at`.
  - Order by `priority_score DESC`, limit `limitPerCategory`.
  - Join with `service_provider_profiles` by `user_id` to get:
    - `business_name`, `city`, `rating`, `total_reviews`, `profile_image_url`, etc.

**Response shape (example):**

```json
{
  "success": true,
  "data": [
    {
      "categoryId": "cat_electrician",
      "categoryLabelBg": "Електротехник",
      "providers": [
        {
          "id": "user_123",
          "businessName": "Електро Мастер ООД",
          "city": "София",
          "rating": 4.9,
          "totalReviews": 27,
          "profileImageUrl": "https://...",
          "isVipHomepage": true
        }
      ]
    }
  ]
}
```

**Web homepage:**

- New component (e.g. `<VipHomepageStrip />`) on `HomePage`:
  - Calls `/vip-homepage`.
  - Shows a strip or carousels: "VIP електротехници", etc.

**Mobile customer home:**

- On `CustomerDashboardScreen` (when implementing):
  - Fetch `/vip-homepage`.
  - Display top VIPs as a horizontal carousel or cards at top.

---

## 6. SP‑Facing APIs & UX (Web + Mobile)

### 6.1 New VIP API Endpoints (Conceptual)

All under a new controller, e.g. `/api/v1/vip`:

#### 0. `GET /api/v1/vip/config` (Public/Authenticated)

Returns all configuration needed by frontends. **No hardcoded values in frontend.**

**Response:**
```json
{
  "success": true,
  "data": {
    "homepageVip": {
      "startBidPoints": 50,
      "buyoutPoints": 120,
      "slotsPerCategory": 3,
      "labelBg": "Начална страница VIP"
    },
    "searchVip": {
      "startBidPoints": 25,
      "buyoutPoints": 100,
      "slotsPerCategory": 3,
      "labelBg": "Търсене VIP"
    },
    "minBidIncrement": 5,
    "maxBidPoints": 500,
    "auctionWindow": {
      "dayOfWeek": 0,
      "startHour": 0,
      "endHour": 22,
      "timezone": "Europe/Sofia",
      "labelBg": "Неделя 00:00 – 22:00"
    },
    "settlementWindow": {
      "dayOfWeek": 0,
      "startHour": 22,
      "endHour": 24,
      "labelBg": "Неделя 22:00 – 00:00 (обработка)"
    },
    "coverageWindow": {
      "startDay": 1,
      "endDay": 0,
      "labelBg": "Понеделник – Неделя (7 дни)"
    },
    "nextAuction": {
      "startsAt": "2025-12-07T00:00:00+02:00",
      "endsAt": "2025-12-07T21:59:59+02:00",
      "settlementAt": "2025-12-07T22:00:00+02:00",
      "coverageStart": "2025-12-08T00:00:00+02:00",
      "coverageEnd": "2025-12-14T23:59:59+02:00"
    },
    "isAuctionOpen": false
  }
}
```

#### 1. `GET /api/v1/vip/overview` (Authenticated SP)

Returns SP's current VIP status.

**Response:**
```json
{
  "success": true,
  "data": {
    "currentPlacements": [
      {
        "vipType": "homepage",
        "categoryId": "cat_electrician",
        "categoryLabelBg": "Електротехник",
        "city": null,
        "pointsSpent": 75,
        "rank": 2,
        "expiresAt": "2025-12-07T23:59:59+02:00"
      }
    ],
    "pointsBalance": 125,
    "nextAuction": { ... }
  }
}
```

#### 2. `GET /api/v1/vip/auctions` (Authenticated SP)

Optional filters: `vipType`, `categoryId`.

Returns auctions SP can participate in (based on their categories and city).

#### 3. `POST /api/v1/vip/bid` (Authenticated SP)

Place or increase bid (see §4.2).

**Request:**
```json
{
  "vipType": "homepage",
  "categoryId": "cat_electrician",
  "pointsIncrement": 10
}
```

**Response (success):**
```json
{
  "success": true,
  "data": {
    "bidId": "bid_123",
    "newBidAmount": 60,
    "rank": 2,
    "message": "Офертата е успешно повишена."
  }
}
```

#### 4. `POST /api/v1/vip/buyout` (Authenticated SP)

Trigger buyout with **immediate points deduction**.

**Request:**
```json
{
  "vipType": "search",
  "categoryId": "cat_electrician"
}
```

**Response (success):**
```json
{
  "success": true,
  "data": {
    "bidId": "bid_456",
    "pointsDeducted": 100,
    "newPointsBalance": 25,
    "message": "VIP слотът е закупен успешно!"
  }
}
```

#### 5. `DELETE /api/v1/vip/bid/:bidId` (Authenticated SP)

Cancel a bid during auction window (Sunday 00:00–21:59:59).

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Офертата е отменена."
  }
}
```

#### 6. `GET /api/v1/vip/leaderboard` (Authenticated SP)

Query params: `vipType`, `categoryId`, `city` (for search).

**Only returns data during auction window (Sunday 00:00–21:59:59).**

**Response:**
```json
{
  "success": true,
  "data": {
    "isAuctionOpen": true,
    "bids": [
      {
        "rank": 1,
        "providerName": "Иван Петров",
        "businessName": "Електро Про",
        "city": "София",
        "bidAmount": 85,
        "isCurrentUser": false
      },
      {
        "rank": 2,
        "providerName": "Георги Димитров",
        "businessName": "ГД Електрик",
        "city": "Пловдив",
        "bidAmount": 60,
        "isCurrentUser": true
      }
    ],
    "buyoutsTaken": 1,
    "slotsRemaining": 2
  }
}
```

### 6.2 SP UX – Web (Marketplace)

- New page: `/provider/vip`.

Sections:

- **Summary**
  - Active VIP this week (chips: category + type + city).
  - Points spent on VIP this week.

- **Upcoming Auctions**
  - Tiles per category:
    - Homepage VIP + Search VIP chips.
    - Countdown until next auction.

- **Auction Detail**
  - Leaderboard list (names + bids + rank).
  - Your current bid highlighted.
  - Controls: `+5`, `+10`, `+25`, custom numeric input.
  - Buyout card with immediate charge warning text.

### 6.3 SP UX – Mobile App

- Entry point: `ModernDashboardScreen.tsx`.
  - New card: "VIP видимост" with small summary.
  - On press → `VipVisibilityScreen`.

- **VipVisibilityScreen** (new):
  - **Top**: Active VIP placements this week.
  - **Middle**: Upcoming auctions (list of categories/cities with VIP type badges).
  - Tap auction → bottom sheet with:
    - Current bid & rank.
    - Leaderboard (with provider names & bids).
    - Buttons for bid increments.
    - Buyout button with clear warning: points will be deducted immediately.

---

## 7. Edge Cases & Safeguards

- **No bids for a scope**:
  - No VIP displayed for that category/week.

- **Fewer than 3 winners**:
  - Show only actual winners.

- **Insufficient points at settlement**:
  - Candidate winner with insufficient points → mark `status='lost'`, no deduction.
  - Move to next candidate.

- **Buyout & further bidding**:
  - Once SP buyouts a slot for a scope, they **cannot place further bids** for that (vipType, category, [city], week).

- **Abuse prevention** (v1):
  - Optional cap on `bid_amount` (e.g. max 500 points per auction).
  - Clear logs in `sp_points_transactions` using `metadata.feature = 'vip_*'` for auditing.

- **VIP transparency for customers**:
  - All VIP cards/providers shown to customers MUST display a clear label: **"VIP • Платена видимост"**.
  - This ensures customers understand these are paid placements, not organic rankings.
  - Use a subtle gold/amber badge or ribbon, consistent with existing premium badge styling.

- **Leaderboard visibility**:
  - Leaderboard endpoint (`/vip/leaderboard`) is **only accessible during auction window** (Sunday 00:00–21:59:59).
  - Outside auction window, returns empty or error: "Търгът не е активен."
  - During auction: shows all current bids with provider names, bid amounts, and ranks.

- **Old bid rows cleanup**:
  - Rows with `expires_at < NOW() - INTERVAL '30 days'` can be archived or deleted via scheduled job.
  - Keep recent history (last 30 days) for analytics and dispute resolution.
  - Archive to a separate table or simply delete if storage is not a concern.

---

## 8. Implementation Order (Detailed, 2 Stages)

### Stage 1: Mobile App (Priority)

**1.1 Backend Foundation**
- Create `VipService.ts` with business logic.
- Create `vipController.ts` with endpoints:
  - `GET /api/v1/vip/config` – returns prices, slot count, timing, min increment (for frontend config).
  - `GET /api/v1/vip/overview` – SP's current VIP status + next auction info.
  - `GET /api/v1/vip/auctions` – available auctions for SP.
  - `POST /api/v1/vip/bid` – place/increase bid.
  - `POST /api/v1/vip/buyout` – buyout slot (immediate charge).
  - `DELETE /api/v1/vip/bid/:bidId` – cancel bid.
  - `GET /api/v1/vip/leaderboard` – current bids during auction.
- Extend `/marketplace/providers/search`:
  - Add `isVipSearch` boolean to response.
  - Adjust ordering to put VIP providers on top.
- Add `GET /api/v1/marketplace/providers/vip-homepage` endpoint.
- Add VIP notification types to `NotificationService`.
- Register routes in `server.ts` and update `API_REGISTRY.md`.
- Build and restart backend.

**1.2 Mobile App – SP Side**
- Add VIP methods to `ApiService.ts`:
  - `getVipConfig()`, `getVipOverview()`, `getVipAuctions()`, `placeVipBid()`, `buyoutVipSlot()`, `cancelVipBid()`, `getVipLeaderboard()`.
- Create `VipVisibilityScreen.tsx`:
  - Follow existing theme (dark gradient, card styles).
  - All text in Bulgarian.
  - Fetch config from backend (no hardcoded prices).
  - Show current VIP placements.
  - Show upcoming auctions with bid controls.
  - Leaderboard bottom sheet.
  - Buyout confirmation dialog: "Сигурен ли си? Точките ще бъдат удържани веднага."
- Add VIP card to `ModernDashboardScreen.tsx`:
  - Title: "VIP видимост".
  - Summary: "0 активни" / "2 активни VIP слота".
  - On press → navigate to `VipVisibilityScreen`.
- Update `types.ts` and `AppNavigator.tsx` for new screen.

**1.3 Mobile App – Customer Side**
- Update `SearchScreen.tsx`:
  - Split providers by `isVipSearch`.
  - Render VIP section at top: "VIP {categoryLabel} в {city}".
  - VIP cards with gold badge: "VIP • Платена видимост".
- Update `CustomerDashboardScreen.tsx`:
  - Fetch `/marketplace/providers/vip-homepage`.
  - Display VIP carousel at top.
  - Cards with "VIP • Платена видимост" label.

**1.4 Backend Scheduler**
- Add cron jobs (using `node-cron` or pm2 config):
  - **Saturday 18:00**: send auction reminder notifications ("Утре започват VIP търговете!").
  - **Sunday 00:00**: open auctions (create/activate auction context, send "търгът е отворен" notification).
  - **Sunday 21:00**: send last-hour reminder ("Остава 1 час!").
  - **Sunday 22:00**: close auctions, settle winners, deduct points, send result notifications.
  - **Monthly**: cleanup old bid rows (>30 days expired).

**1.5 Stage 1 Testing**
- Test full auction cycle with test data.
- Verify buyout immediate point deduction.
- Verify notifications (reminder, outbid, result).
- Verify VIP display in search and homepage for customers.
- All Bulgarian text review.

---

### Stage 2: Web Marketplace

**2.1 Web – SP Side**
- Create `/provider/vip` page:
  - Same features as mobile `VipVisibilityScreen`.
  - Use existing Tailwind theme and component patterns.
  - All text in Bulgarian.
  - Fetch config from backend.
- Add VIP card to SP dashboard (`/provider/dashboard`).

**2.2 Web – Customer Side**
- Create `<VipHomepageStrip />` component:
  - Fetches `/marketplace/providers/vip-homepage`.
  - Displays per-category VIP carousels.
  - Add to `HomePage`.
- Update `/search` page:
  - Split providers by `isVipSearch`.
  - VIP section at top with gold badge styling.
  - Label: "VIP • Платена видимост".

**2.3 Stage 2 Testing**
- Verify parity with mobile features.
- Verify synchronization (web and mobile show same VIP data).
- All Bulgarian text review.
- Cross-browser testing.

---

### Post-Launch

- Monitor auction participation.
- Analyze VIP effectiveness (views, clicks, conversions).
- Consider future enhancements:
  - Multi-city Search VIP bidding.
  - VIP analytics dashboard for SPs.
  - Auto-bid feature (max budget, auto-increment).
