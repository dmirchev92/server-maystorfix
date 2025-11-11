# Bidding Points System - Two-Stage Payment

## Overview
The bidding system uses a **two-stage payment model** that balances fairness and commitment:

1. **Participation Fee** - Small upfront cost for all bidders
2. **Tier-Based Full Cost** - Winner pays remaining amount based on their subscription tier

---

## Payment Structure

### Stage 1: Placing a Bid (All Bidders)
**Participation Fee: 3 points** (same for all tiers)

- Charged immediately when placing a bid
- Non-refundable (keeps bidders committed)
- Same cost regardless of tier or case budget

### Stage 2: Winning the Bid (Winner Only)
**Remaining Tier-Based Cost** = Full Cost - Participation Fee

The full cost is calculated based on:
- Case budget range
- Provider's subscription tier

---

## Point Costs by Tier and Budget Range

### FREE Tier (40 points/month, max 500 BGN)

| Budget Range | Full Cost | Participation Fee | Winner Pays Extra | Total if Win |
|--------------|-----------|-------------------|-------------------|--------------|
| 1-250 BGN    | 6 points  | 3 points          | 3 points          | 6 points     |
| 250-500 BGN  | 10 points | 3 points          | 7 points          | 10 points    |
| 500+ BGN     | ❌ Not available | - | - | - |

### NORMAL Tier (150 points/month, max 1500 BGN)

| Budget Range | Full Cost | Participation Fee | Winner Pays Extra | Total if Win |
|--------------|-----------|-------------------|-------------------|--------------|
| 1-250 BGN    | 4 points  | 3 points          | 1 point           | 4 points     |
| 250-500 BGN  | 7 points  | 3 points          | 4 points          | 7 points     |
| 500-750 BGN  | 12 points | 3 points          | 9 points          | 12 points    |
| 750-1000 BGN | 18 points | 3 points          | 15 points         | 18 points    |
| 1000-1500 BGN| 25 points | 3 points          | 22 points         | 25 points    |
| 1500+ BGN    | ❌ Not available | - | - | - |

### PRO Tier (250 points/month, unlimited)

| Budget Range | Full Cost | Participation Fee | Winner Pays Extra | Total if Win |
|--------------|-----------|-------------------|-------------------|--------------|
| 1-250 BGN    | 3 points  | 3 points          | 0 points          | 3 points     |
| 250-500 BGN  | 5 points  | 3 points          | 2 points          | 5 points     |
| 500-750 BGN  | 8 points  | 3 points          | 5 points          | 8 points     |
| 750-1000 BGN | 12 points | 3 points          | 9 points          | 12 points    |
| 1000-1500 BGN| 18 points | 3 points          | 15 points         | 18 points    |
| 1500-2000 BGN| 25 points | 3 points          | 22 points         | 25 points    |
| 2000-3000 BGN| 35 points | 3 points          | 32 points         | 35 points    |
| 3000-4000 BGN| 45 points | 3 points          | 42 points         | 45 points    |
| 4000-5000 BGN| 55 points | 3 points          | 52 points         | 55 points    |

---

## Example Scenarios

### Scenario 1: FREE Tier User Bids on 1-250 BGN Case

**When Bidding:**
- Pays: 3 points (participation fee)
- Balance: 40 → 37 points

**If Loses:**
- No additional charge
- Final cost: 3 points
- Balance remains: 37 points

**If Wins:**
- Pays: 3 more points (6 total - 3 already paid)
- Final cost: 6 points total
- Balance: 37 → 34 points

### Scenario 2: NORMAL Tier User Bids on 1000-1500 BGN Case

**When Bidding:**
- Pays: 3 points (participation fee)
- Balance: 150 → 147 points

**If Loses:**
- No additional charge
- Final cost: 3 points
- Balance remains: 147 points

**If Wins:**
- Pays: 22 more points (25 total - 3 already paid)
- Final cost: 25 points total
- Balance: 147 → 125 points

### Scenario 3: PRO Tier User Bids on 1-250 BGN Case

**When Bidding:**
- Pays: 3 points (participation fee)
- Balance: 250 → 247 points

**If Loses:**
- No additional charge
- Final cost: 3 points
- Balance remains: 247 points

**If Wins:**
- Pays: 0 more points (3 total - 3 already paid)
- Final cost: 3 points total (participation fee covers full cost!)
- Balance remains: 247 points

---

## Benefits of Two-Stage System

### For Service Providers
1. **Low Risk Entry** - Only 3 points to participate
2. **Fair Competition** - Everyone pays same participation fee
3. **Tier Benefits** - Higher tiers pay less if they win
4. **No Surprise Costs** - Know exact cost before bidding

### For the Platform
1. **Commitment Filter** - 3-point fee keeps bidders serious
2. **Revenue Model** - Losers contribute participation fees
3. **Tier Incentive** - Clear value in upgrading tiers
4. **Fair Distribution** - Points reflect case value

---

## Technical Implementation

### When Placing Bid (`BiddingService.placeBid`)

```typescript
// 1. Calculate full tier-based cost
const fullPointsCost = calculatePointsCost(caseBudget, tierLimits);

// 2. Charge only participation fee (3 points)
const participationFee = 3;
deductPoints(providerId, participationFee);

// 3. Store full cost in bid record for later
saveBid({
  points_bid: fullPointsCost,
  participation_points: participationFee,
  points_deducted: participationFee
});
```

### When Selecting Winner (`BiddingService.selectWinningBid`)

```typescript
// 1. Calculate remaining cost
const remainingPoints = winningBid.points_bid - winningBid.participation_points;

// 2. Charge winner the remaining amount
if (remainingPoints > 0) {
  deductPoints(winnerId, remainingPoints);
}

// 3. Update bid record
updateBid(winningBidId, {
  bid_status: 'won',
  points_deducted: winningBid.points_bid // Full amount
});

// 4. Losers keep only participation fee deducted
updateLosingBids({
  bid_status: 'lost',
  points_deducted: participation_points // Only 3 points
});
```

---

## Database Schema

### sp_case_bids Table
```sql
- points_bid: INTEGER           -- Full tier-based cost
- participation_points: INTEGER  -- Participation fee paid (3)
- points_deducted: INTEGER      -- Total points actually charged
- bid_status: TEXT              -- pending, won, lost
```

**Point Tracking:**
- `participation_points`: Always 3 (paid when bidding)
- `points_bid`: Full tier-based cost (6, 10, 25, etc.)
- `points_deducted`: 
  - When bidding: 3 (participation fee)
  - If loses: 3 (stays at participation fee)
  - If wins: Full `points_bid` amount

---

## Monthly Access Potential

### FREE Tier (40 points/month)
- Can bid on **13 cases** (40 ÷ 3 = 13 participation fees)
- If wins 1 small case (1-250 BGN): 6 points total
- Remaining: 34 points = 11 more bids possible

### NORMAL Tier (150 points/month)
- Can bid on **50 cases** (150 ÷ 3 = 50 participation fees)
- If wins 1 large case (1000-1500 BGN): 25 points total
- Remaining: 125 points = 41 more bids possible

### PRO Tier (250 points/month)
- Can bid on **83 cases** (250 ÷ 3 = 83 participation fees)
- If wins 1 premium case (3000-4000 BGN): 45 points total
- Remaining: 205 points = 68 more bids possible

---

## Status
✅ **IMPLEMENTED AND DEPLOYED**

**Date:** November 11, 2025  
**Participation Fee:** 3 points (all tiers)  
**Winner Payment:** Tier-based (remaining cost after participation fee)
