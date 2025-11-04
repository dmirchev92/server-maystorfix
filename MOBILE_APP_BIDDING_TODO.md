# Mobile App - Bidding System Implementation TODO

## Overview
The bidding system is fully implemented on the web platform. The mobile app needs to be updated to support the same functionality.

## Current Status
- ✅ Backend API endpoints are ready and working
- ✅ Web implementation is complete and tested
- ❌ Mobile app needs implementation

## Required Mobile App Changes

### 1. API Client Updates (`mobile-app/src/services/ApiService.ts`)
Add the following methods:

```typescript
// Bidding endpoints
async canBidOnCase(caseId: string): Promise<ApiResponse> {
  return this.get(`/bidding/case/${caseId}/can-bid`);
}

async placeBid(caseId: string): Promise<ApiResponse> {
  return this.post(`/bidding/case/${caseId}/bid`, {});
}

async getCaseBids(caseId: string, includeProviderInfo: boolean = false): Promise<ApiResponse> {
  return this.get(`/bidding/case/${caseId}/bids?includeProviderInfo=${includeProviderInfo}`);
}

async selectWinningBid(caseId: string, bidId: string): Promise<ApiResponse> {
  return this.post(`/bidding/case/${caseId}/select-winner`, { bidId });
}

async getMyBids(): Promise<ApiResponse> {
  return this.get('/bidding/my-bids');
}

// Points endpoints
async getPointsBalance(): Promise<ApiResponse> {
  return this.get('/points/balance');
}

async getPointsTransactions(page: number = 1, limit: number = 20): Promise<ApiResponse> {
  return this.get(`/points/transactions?page=${page}&limit=${limit}`);
}
```

### 2. Case Creation Screen
**File:** `mobile-app/src/screens/CreateCaseScreen.tsx`

Add budget field:
- Input field for budget amount (numeric)
- Toggle for "Enable bidding" (automatically enabled if budget > 0)
- Info text: "Специалистите ще наддават за вашата заявка"
- Budget validation (minimum 100 BGN, maximum based on tier)

### 3. Service Provider Dashboard
**File:** `mobile-app/src/screens/DashboardScreen.tsx` or Cases list

Add for service providers:
- Points balance widget at the top
- "Наддай" button on case cards (only for cases with bidding enabled)
- Points cost estimate below button (~30-60 точки)
- Disable button if:
  - Already bid on this case
  - Max bidders reached (3/3)
  - Insufficient points

### 4. Customer Cases Screen
**File:** Create new `mobile-app/src/screens/MyCasesScreen.tsx`

Show customer's cases with:
- Case list with status badges
- "Виж оферти (X)" button for cases with bids
- Budget display on case cards
- Filter by status (pending, accepted, completed)

### 5. Bid Review Screen
**File:** Create new `mobile-app/src/screens/BidReviewScreen.tsx`

For customers to review bids:
- List of all bidders (max 3)
- Show for each bidder:
  - Name, email, phone
  - Rating and completed cases
  - Bid order (#1, #2, #3)
  - "Избери" button
- Confirmation dialog before selecting winner
- Navigate to provider profile option

### 6. Points Balance Screen
**File:** Create new `mobile-app/src/screens/PointsScreen.tsx`

Show:
- Current points balance (large display)
- Monthly points allocation
- Points history/transactions
- Spent vs. Earned breakdown
- Link to subscription upgrade

### 7. My Bids Screen
**File:** Create new `mobile-app/src/screens/MyBidsScreen.tsx`

For service providers:
- List of all their bids
- Status: pending, won, lost
- Case details for each bid
- Points spent/refunded
- Filter by status

### 8. Navigation Updates
**File:** `mobile-app/src/navigation/AppNavigator.tsx`

Add new screens:
- MyCasesScreen (for customers)
- BidReviewScreen (for customers)
- PointsScreen (for service providers)
- MyBidsScreen (for service providers)

Update bottom tab navigation:
- Service Providers: Add "Точки" tab
- Customers: Add "Моите заявки" tab

### 9. UI Components Needed

#### PointsBalanceWidget
```typescript
// Display points balance with icon
<PointsBalanceWidget 
  balance={150} 
  onPress={() => navigation.navigate('Points')}
/>
```

#### BidButton
```typescript
// Bid button with points estimate
<BidButton 
  caseId={caseId}
  budget={1500}
  onBidPlaced={() => refreshCases()}
  disabled={alreadyBid || maxBiddersReached}
/>
```

#### BidderCard
```typescript
// Display bidder info in review screen
<BidderCard 
  bidder={bidderData}
  onSelect={() => selectWinner(bidderId)}
  onViewProfile={() => navigation.navigate('ProviderProfile', { id })}
/>
```

### 10. Notifications
Update notification handling for:
- "New bid on your case" (for customers)
- "You won the bid!" (for service providers)
- "Bid refund processed" (for losing bidders)
- "Low points balance" (for service providers)

## API Endpoints Reference

### Bidding
- `GET /api/v1/bidding/case/:caseId/can-bid` - Check if can bid
- `POST /api/v1/bidding/case/:caseId/bid` - Place a bid
- `GET /api/v1/bidding/case/:caseId/bids` - Get all bids for a case
- `POST /api/v1/bidding/case/:caseId/select-winner` - Select winning bid
- `GET /api/v1/bidding/my-bids` - Get my bids

### Points
- `GET /api/v1/points/balance` - Get points balance
- `GET /api/v1/points/transactions` - Get points transaction history

## Testing Checklist

### Service Provider Flow
- [ ] View cases with budget
- [ ] See points cost estimate
- [ ] Place bid on case
- [ ] See bid in "My Bids"
- [ ] Receive notification when selected as winner
- [ ] Receive refund when not selected

### Customer Flow
- [ ] Create case with budget
- [ ] See "Виж оферти" button when bids arrive
- [ ] View all bidders
- [ ] Select winner
- [ ] See case assigned to winner
- [ ] Leave review after completion

### Edge Cases
- [ ] Prevent duplicate bids
- [ ] Handle insufficient points
- [ ] Handle max bidders reached
- [ ] Handle network errors gracefully
- [ ] Sync points balance across screens

## Priority
**HIGH** - This is a core feature that's already live on web. Mobile users need parity.

## Estimated Effort
- API Integration: 2-3 hours
- UI Screens: 8-10 hours
- Testing: 3-4 hours
- **Total: 13-17 hours**

## Notes
- All backend APIs are tested and working
- Web implementation can be used as reference
- Points system is tied to subscription tiers
- Free tier: 50 points/month
- Normal tier: 100 points/month  
- Pro tier: 150 points/month
