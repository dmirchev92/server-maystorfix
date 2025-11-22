# Implementation Plan: "Uber-like" Service Provider Search & Enhanced Bidding

## 1. Project Status & Backup
- **Backup Created**: `servicetextpro_full_backup_[timestamp].tar.gz` (Contains `backend`, `Marketplace`, `mobile-app`).
- **Database**: PostgreSQL (verified via MCP).
- **Current Schema**:
  - `marketplace_service_cases`: Main case table. Missing location coordinates.
  - `sp_case_bids`: Exists. Has `proposed_budget_range` and `bid_comment`.
  - `subscription_tiers`: Defines 'free', 'normal', 'pro'.
  - `sp_subscriptions`: Links users to tiers.

## 2. Database Changes
We need to modify `marketplace_service_cases` to store precise location data and track the search process.

### New Columns for `marketplace_service_cases`
| Column Name | Data Type | Purpose |
|-------------|-----------|---------|
| `latitude` | `DOUBLE PRECISION` | Exact GPS latitude of the job. |
| `longitude` | `DOUBLE PRECISION` | Exact GPS longitude of the job. |
| `formatted_address` | `TEXT` | Validated address string from Google Maps. |
| `location_search_status` | `VARCHAR(20)` | `active`, `expanded`, `completed`. Tracks the radius expansion. |
| `search_radius_km` | `INTEGER` | Current search radius (5 or 10). Default 5. |
| `location_search_started_at` | `TIMESTAMP` | When the search began (for timing the expansion). |
| `exclusive_until` | `TIMESTAMP` | Timestamp until which ONLY PRO users can see/bid. |

### SQL Migration Script
```sql
ALTER TABLE marketplace_service_cases 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS formatted_address TEXT,
ADD COLUMN IF NOT EXISTS location_search_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS search_radius_km INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS location_search_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exclusive_until TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_cases_exclusive_until ON marketplace_service_cases(exclusive_until);
CREATE INDEX IF NOT EXISTS idx_cases_location_search ON marketplace_service_cases(location_search_status);
```

## 3. Backend Logic & APIs

### A. Case Creation (`caseController.ts`)
- **Input**: Accept `latitude`, `longitude`, `address` from client.
- **Logic**:
  - If location is provided:
    - Set `location_search_status` = `'active'`.
    - Set `search_radius_km` = `5`.
    - Set `location_search_started_at` = `NOW()`.
    - Set `exclusive_until` = `NOW() + 10 minutes`.
  - Save new fields to DB.

### B. SP Case Visibility (`getAvailableCases`)
- **Logic**:
  - Fetch user's subscription tier from `sp_subscriptions`.
  - If Tier != `'pro'`:
    - Add SQL filter: `AND (exclusive_until IS NULL OR exclusive_until <= NOW())`.
  - This ensures PRO users see cases 10 minutes before others.

### C. Background Search Service (`LocationSearchJob.ts`)
- **Trigger**: Cron job every 1 minute (or event-based).
- **Logic**:
  1. **Initial Search (Radius 5km)**:
     - Find cases where `location_search_status` = `'active'` AND `search_radius_km` = 5.
     - Query `service_provider_profiles` table to find providers within 5km of case `lat/long`.
     - Uses existing `latitude` and `longitude` columns in `service_provider_profiles`.
     - Send Push Notifications to found SPs.
  2. **Expansion (Radius 10km)**:
     - Find cases where `location_search_status` = `'active'` AND `location_search_started_at` < `NOW() - 10 minutes`.
     - Update `search_radius_km` = 10.
     - Set `location_search_status` = `'expanded'`.
     - Find SPs within 10km in `service_provider_profiles` (excluding those already notified).
     - Send Push Notifications.

### D. Bidding/Offers (`biddingController.ts`)
- Existing `sp_case_bids` table already supports:
  - `proposed_budget_range`
  - `bid_comment`
- **Enhancement**: Ensure `placeBid` allows SP to propose a budget even if it differs from customer's budget. (Existing logic seems to allow this).
- **Customer View**:
  - API to list all bids for a case.
  - "Accept Offer" endpoint needs to:
    - Update case status to `accepted`.
    - Set `winning_bid_id`.
    - **Auto-Decline** other bids (update their status to `rejected`).

### E. Live Provider Tracking (New Feature)
- **Database**: New table `sp_tracking_sessions` (or similar) to store history (Rule #3: Postgres only).
  - Columns: `id`, `provider_id`, `case_id`, `latitude`, `longitude`, `timestamp`.
- **API**: 
  - `POST /api/v1/tracking/update`: SP app sends GPS coords every 10s.
  - **Real-time**: Server emits `tracking_update` via Socket.IO to the customer's room `case_{caseId}`.
- **Flow**:
  1. SP accepts case -> "Start Travel".
  2. SP App sends coords -> Server updates `service_provider_profiles` (latest) AND inserts into `sp_tracking_sessions` (history).
  3. Server emits event.
  4. Customer App (listening on Socket) moves car icon.

## 4. Frontend / Mobile Implementation

### A. Customer - Create Case
- **New Screen/Step**: "Select Location".
- **Integration**: Google Maps SDK / Google Places Autocomplete.
- **Flow**:
  1. Type address.
  2. Select from autocomplete.
  3. Show map with pin.
  4. Confirm location (Get Lat/Long).
  5. Proceed to service details.

### B. Service Provider - Dashboard
- **Exclusive Cases**: Visual indicator (e.g., "EARLY ACCESS" badge) for PRO users seeing cases in the `exclusive_until` window.
- **Map View**: Show the case location on a map in the Case Details screen.
- **Bidding UI**:
  - If customer budget is low, show "Propose New Budget" input.
  - Submit bid with proposal.

## 5. Required Resources
- **Google Maps API Key**: Needed for Geocoding/Places/Maps SDK.
- **Postgres extension `postgis` (Optional)**: For efficient geospatial queries (`ST_DWithin`). *Without it, we can use Haversine formula in standard SQL.*

## 6. Next Steps
1. Run DB Migration.
2. Modify `createCase` API.
3. Implement `LocationSearchJob`.
4. Update Frontend to send location data.
