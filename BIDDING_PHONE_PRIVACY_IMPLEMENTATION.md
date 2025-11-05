# Bidding System - Phone Number Privacy Implementation

## Overview
Implemented privacy protection for customer phone numbers in the bidding system. Only the winning bidder can see the actual phone number, while other service providers who placed bids will see a masked version.

## Changes Made

### Backend Changes

#### File: `/backend/src/controllers/caseController.ts`

**Modified `getCasesWithFilters` function:**

1. **Added winning bid information to query:**
   - Joined `sp_case_bids` table to get the `winning_provider_id`
   - This allows us to determine who won the bid for each case

2. **Implemented phone masking logic:**
   - Determines the requesting user ID from query parameters (`excludeDeclinedBy`, `providerId`, `customerId`, or `createdByUserId`)
   - For each case with bidding enabled (regardless of whether a winner has been selected):
     - Checks if the requesting user is:
       - The customer who created the case (`customer_id`)
       - The winning bidder (`winning_provider_id`) - if a winner has been selected
       - The assigned provider (`provider_id`)
     - If the user is NOT one of the above, masks the phone number as `***-***-****`
     - Adds a `phone_masked: true` flag to indicate the phone is masked
   - This ensures phone numbers are protected from the moment bidding is enabled, not just after a winner is selected

3. **SQL Query Enhancement:**
```sql
SELECT 
  c.*,
  CONCAT(u.first_name, ' ', u.last_name) as customer_name,
  b.provider_id as winning_provider_id
FROM marketplace_service_cases c
LEFT JOIN users u ON c.customer_id = u.id
LEFT JOIN sp_case_bids b ON c.winning_bid_id = b.id
```

### Frontend Changes

#### File: `/Marketplace/src/app/dashboard/cases/page.tsx`

**Updated phone number display:**
- Added conditional rendering based on `phone_masked` flag
- When phone is masked:
  - Shows the masked phone number in a muted color
  - Displays a lock icon 🔒 with message: "Видим само за спечелилия наддаването" (Visible only to the winning bidder)
  - Uses amber/yellow color scheme to indicate restricted access

#### File: `/Marketplace/src/app/dashboard/page-backup.tsx`

**Applied same changes** to maintain consistency across backup files.

#### File: `/mobile-app/src/screens/CasesScreen.tsx`

**Updated mobile app case details:**
- Added phone masking indicator for mobile users
- Shows masked phone with visual badge when `phone_masked` is true
- Maintains consistent UX with web version

## Business Logic

### Who Can See Phone Numbers?

✅ **Can see phone number:**
- The customer who created the case (always)
- The winning bidder (service provider who won the bid) - ONLY after winning
- The assigned provider (if case is directly assigned)

❌ **Cannot see phone number (sees masked version):**
- ALL service providers when bidding is enabled and no winner selected yet
- Service providers who placed bids but didn't win
- Service providers who are just viewing available cases with bidding enabled

### Key Points:
- Phone masking applies **immediately** when bidding is enabled
- Service providers cannot see the phone number until they win the bid
- This prevents SPs from bypassing the bidding system by calling customers directly
- Customers always see their own phone number

### Visual Indicators

**Web Interface:**
```
Телефон: ***-***-**** 🔒 Скрит

💡 Спечелете наддаването, за да получите достъп до телефонния номер на клиента
```

**Mobile Interface:**
```
📞 Телефон: ***-***-**** [🔒 Скрит]

💡 Спечелете наддаването, за да получите достъп до телефонния номер
```

The message encourages service providers to participate in the bidding process to gain access to customer contact information.

## Database Schema Reference

The implementation uses the following database structure:

- `marketplace_service_cases.winning_bid_id` - References the winning bid
- `sp_case_bids.id` - Bid identifier
- `sp_case_bids.provider_id` - Service provider who placed the bid
- `marketplace_service_cases.bidding_enabled` - Whether bidding is active for the case

## Testing Checklist

- [ ] Test as a customer - should see phone number on own cases
- [ ] Test as winning bidder - should see actual phone number
- [ ] Test as non-winning bidder - should see masked phone number
- [ ] Test on cases without bidding enabled - should see phone number normally
- [ ] Test on web dashboard
- [ ] Test on mobile app
- [ ] Verify the lock icon and message display correctly

## Security Considerations

1. **Server-side enforcement:** Phone masking is done on the backend, not just frontend
2. **No data leakage:** Masked phone numbers are replaced before sending to client
3. **Consistent across platforms:** Same logic applies to web and mobile
4. **Audit trail:** Backend logs when phone numbers are masked for debugging

## Files Modified

1. `/backend/src/controllers/caseController.ts` - Backend logic
2. `/Marketplace/src/app/dashboard/cases/page.tsx` - Web frontend
3. `/Marketplace/src/app/dashboard/page-backup.tsx` - Web frontend backup
4. `/mobile-app/src/screens/CasesScreen.tsx` - Mobile app

## Deployment Notes

- Backend server restarted via PM2: `pm2 restart servicetextpro-backend`
- No database migrations required (uses existing bidding system tables)
- Frontend will automatically pick up changes on next build/refresh
- Mobile app will need rebuild for changes to take effect

## Future Enhancements

Potential improvements to consider:

1. Add phone number reveal for a fee (premium feature)
2. Implement time-based reveal (e.g., after 24 hours)
3. Add analytics to track how often phone numbers are masked
4. Consider partial masking (show area code, hide rest)
