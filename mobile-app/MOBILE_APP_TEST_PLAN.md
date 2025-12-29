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
