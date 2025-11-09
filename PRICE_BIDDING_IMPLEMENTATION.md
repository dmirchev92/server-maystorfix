# Price Bidding System Implementation

## Overview
Upgraded the bidding system from points-only to price-based bidding with budget ranges.

## New Bidding Flow

### 1. **Customer Creates Case**
- Selects budget range from dropdown (e.g., "250-500 лв", "500-750 лв", etc.)
- 9 budget ranges available: 1-250, 250-500, 500-750, 750-1000, 1000-1250, 1250-1500, 1500-1750, 1750-2000, 2000+

### 2. **SP Views Case & Decides to Bid**
- SP clicks "Bid" button
- Pays **5 points participation fee** immediately
- Can bid on up to 3 cases (max 3 bidders per case)

### 3. **SP Proposes Budget Range**
- SP selects their proposed budget range from same dropdown
- SP can add optional comment explaining their approach
- System calculates full points cost based on proposed range (not charged yet)

### 4. **Customer Reviews Bids**
- Sees all 3 bids side-by-side
- Each bid shows:
  - SP name and profile
  - Proposed budget range
  - Optional comment
  - SP rating and completed cases
- Customer selects winning bid

### 5. **Winner Selected**
- **Winner**: Pays full points based on their proposed budget range
  - Example: Proposed "250-500 лв" → Pays full points for that range
  - Already paid 5 points, so pays (full_cost - 5) remaining points
- **Losers**: Keep only 5 points deducted (participation fee)
  - No additional charges
  - Fair system - only pay if you win

## Database Changes

### Migration: `027_add_price_bidding_fields.sql`

Added columns to `sp_case_bids` table:
```sql
- proposed_budget_range TEXT  -- SP's proposed budget (e.g., "250-500")
- bid_comment TEXT            -- SP's explanation
- participation_points INT    -- Points paid to participate (default 5)
```

### Points Calculation
- **Participation**: 5 points (paid immediately)
- **Full Cost**: Calculated from proposed budget range midpoint
  - "1-250" → 125 лв midpoint
  - "250-500" → 375 лв midpoint
  - "2000+" → 2500 лв estimate
- **Winner Pays**: Full cost based on their proposed range
- **Losers Pay**: Only 5 points (participation fee)

## Backend Changes

### Files Modified:

1. **`migrations/027_add_price_bidding_fields.sql`**
   - Added new columns for price bidding

2. **`src/services/BiddingService.ts`**
   - Updated `CaseBid` interface with new fields
   - Modified `placeBid()` to accept `proposedBudgetRange` and `bidComment`
   - Charges only 5 points initially
   - Calculates full points based on proposed range
   - Added `getBudgetRangeMidpoint()` helper method
   - Updated `selectWinningBid()` to charge winner full amount, losers keep 5 points

3. **`src/controllers/biddingController.ts`**
   - Updated POST `/api/v1/bidding/case/:caseId/bid` endpoint
   - Now requires `proposed_budget_range` in request body
   - Optional `bid_comment` parameter

### API Endpoints

#### Place Bid
```
POST /api/v1/bidding/case/:caseId/bid
Headers: Authorization: Bearer <token>
Body: {
  "proposed_budget_range": "250-500",
  "bid_comment": "I can complete this in 2 days with premium materials"
}

Response: {
  "success": true,
  "data": {
    "bid_id": "uuid",
    "bid_order": 1,
    "points_spent": 5,
    "message": "Bid placed successfully. You are bidder #1. Participation fee: 5 points. If you win, you'll pay 15 points total."
  }
}
```

#### Get Case Bids (Customer)
```
GET /api/v1/bidding/case/:caseId/bids?includeProviderInfo=true
Headers: Authorization: Bearer <token>

Response: {
  "success": true,
  "data": {
    "bids": [
      {
        "id": "uuid",
        "proposed_budget_range": "250-500",
        "bid_comment": "Fast service with warranty",
        "provider_name": "Ivan Petrov",
        "provider_rating": 4.8,
        "bid_order": 1
      }
    ],
    "count": 3
  }
}
```

#### Select Winner
```
POST /api/v1/bidding/case/:caseId/select-winner
Headers: Authorization: Bearer <token>
Body: {
  "winning_bid_id": "uuid"
}

Response: {
  "success": true,
  "message": "Winner selected successfully"
}
```

## Frontend Changes Needed

### Web (Marketplace)
- [ ] Update bid placement UI to include budget range dropdown
- [ ] Add optional comment textarea
- [ ] Update bid display to show proposed ranges
- [ ] Update customer bid review page

### Mobile App
- [ ] Update bid placement UI to include budget range picker
- [ ] Add optional comment input
- [ ] Update bid display to show proposed ranges
- [ ] Update customer bid review screen

## Budget Ranges

```typescript
const BUDGET_RANGES = [
  { value: '1-250', label: '1-250 лв', min: 1, max: 250 },
  { value: '250-500', label: '250-500 лв', min: 250, max: 500 },
  { value: '500-750', label: '500-750 лв', min: 500, max: 750 },
  { value: '750-1000', label: '750-1000 лв', min: 750, max: 1000 },
  { value: '1000-1250', label: '1000-1250 лв', min: 1000, max: 1250 },
  { value: '1250-1500', label: '1250-1500 лв', min: 1250, max: 1500 },
  { value: '1500-1750', label: '1500-1750 лв', min: 1500, max: 1750 },
  { value: '1750-2000', label: '1750-2000 лв', min: 1750, max: 2000 },
  { value: '2000+', label: '2000+ лв', min: 2000, max: null }
];
```

## Testing Checklist

- [ ] SP can place bid with budget range and comment
- [ ] Only 5 points deducted initially
- [ ] Max 3 bidders per case enforced
- [ ] Customer can view all bids with proposed ranges
- [ ] Customer can select winner
- [ ] Winner pays full points based on proposed range
- [ ] Losers keep only 5 points deducted
- [ ] Case assigned to winner correctly
- [ ] Notifications sent to all parties

## Benefits

1. **Fair for SPs**: Only pay if you win
2. **Transparent Pricing**: Customer sees price proposals upfront
3. **Low Risk**: 5 points to participate is minimal
4. **Competitive**: SPs can compete on price and quality
5. **Flexible**: Budget ranges accommodate uncertainty
6. **Professional**: Comment field allows SPs to explain value

## Next Steps

1. ✅ Database migration completed
2. ✅ Backend API updated
3. ⏳ Frontend UI updates needed
4. ⏳ Testing required
5. ⏳ User documentation
