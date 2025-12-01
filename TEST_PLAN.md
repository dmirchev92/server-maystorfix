# ServiceTextPro Mobile App - Comprehensive Test Plan

## Table of Contents
1. [Authentication Tests](#1-authentication-tests)
2. [User Profile Tests](#2-user-profile-tests)
3. [Case Management Tests](#3-case-management-tests)
4. [Bidding System Tests](#4-bidding-system-tests)
5. [Chat System Tests](#5-chat-system-tests)
6. [Points & Subscription Tests](#6-points--subscription-tests)
7. [Location & Tracking Tests](#7-location--tracking-tests)
8. [Notification Tests](#8-notification-tests)
9. [Review System Tests](#9-review-system-tests)
10. [Marketplace & Search Tests](#10-marketplace--search-tests)
11. [Referral System Tests](#11-referral-system-tests)
12. [API Testing Commands](#api-testing-commands)

---

## Prerequisites

Get a valid auth token first:
```bash
# Login and get token
TOKEN=$(curl -s -X POST https://maystorfix.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' | jq -r '.data.tokens.accessToken')

echo "Token: $TOKEN"
```

---

## 1. Authentication Tests

### 1.1 Login Screen (`AuthScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-AUTH-001 | Login with valid credentials | Navigate to Dashboard |
| TC-AUTH-002 | Login with invalid email format | Show validation error |
| TC-AUTH-003 | Login with wrong password | Show "Invalid credentials" error |
| TC-AUTH-004 | Login with empty fields | Show "Required field" error |
| TC-AUTH-005 | Remember me checkbox | Credentials saved on next launch |
| TC-AUTH-006 | Toggle between Login/Register | Switch form correctly |

### 1.2 Registration
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-REG-001 | Register as Customer | Create account, navigate to dashboard |
| TC-REG-002 | Register as Provider | Create account with service category |
| TC-REG-003 | Password validation (min 8 chars, upper, lower, number, special) | Show password requirements |
| TC-REG-004 | Phone number validation (+359 format) | Validate Bulgarian format |
| TC-REG-005 | Accept Terms checkbox required | Block registration without terms |

### 1.3 Password Reset (`ForgotPasswordScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-PWD-001 | Request password reset | Show "Email sent" message |
| TC-PWD-002 | Reset with invalid email | Show error |

### API Commands - Authentication
```bash
# 1. Health Check
curl -X GET https://maystorfix.com/api/v1/health

# 2. Login
curl -X POST https://maystorfix.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'

# 3. Register (Provider)
curl -X POST https://maystorfix.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newprovider@test.com",
    "password": "Test@123!",
    "firstName": "Иван",
    "lastName": "Петров",
    "phoneNumber": "+359888123456",
    "role": "tradesperson",
    "serviceCategory": "plumber",
    "gdprConsents": ["essential", "marketing"]
  }'

# 4. Get Current User (requires token)
curl -X GET https://maystorfix.com/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 5. Password Reset Request
curl -X POST https://maystorfix.com/api/v1/auth/password-reset-request \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 6. Logout
curl -X POST https://maystorfix.com/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

## 2. User Profile Tests

### 2.1 Edit Profile Screen (`EditProfileScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-PROF-001 | Update first/last name | Save successfully |
| TC-PROF-002 | Update phone number | Validate format, save |
| TC-PROF-003 | Update company name | Save successfully |
| TC-PROF-004 | Upload profile photo | Photo uploaded and displayed |
| TC-PROF-005 | Add service categories | Categories saved |
| TC-PROF-006 | Update neighborhood | Save location preference |

### 2.2 Settings Screen (`SettingsScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-SET-001 | Toggle location tracking | Enable/disable location |
| TC-SET-002 | Navigate to Privacy settings | Open privacy screen |
| TC-SET-003 | Navigate to Consent settings | Open consent screen |
| TC-SET-004 | Logout button | Clear session, return to login |

### API Commands - Profile
```bash
# 1. Update User Profile
curl -X PUT https://maystorfix.com/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Георги",
    "lastName": "Иванов",
    "phoneNumber": "+359888999888",
    "companyName": "Майсторфикс ЕООД"
  }'

# 2. Update Provider Profile
curl -X POST https://maystorfix.com/api/v1/marketplace/providers/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "profile": {
      "bio": "Професионален водопроводчик с 10 години опит",
      "city": "София",
      "neighborhood": "Лозенец"
    }
  }'

# 3. Get Provider Categories
curl -X GET https://maystorfix.com/api/v1/provider/categories \
  -H "Authorization: Bearer $TOKEN"

# 4. Set Provider Categories
curl -X PUT https://maystorfix.com/api/v1/provider/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"categories": ["plumber", "electrician"]}'
```

---

## 3. Case Management Tests

### 3.1 Cases Screen (`CasesScreen.tsx`) - Provider View
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-CASE-001 | View available cases | List loads with filters |
| TC-CASE-002 | Filter by category | Show matching cases only |
| TC-CASE-003 | Filter by city | Show cases in selected city |
| TC-CASE-004 | Filter by neighborhood | Show cases in neighborhood |
| TC-CASE-005 | Accept case | Case moves to "My Cases" |
| TC-CASE-006 | Decline case | Case hidden, reason saved |
| TC-CASE-007 | View case details | Full details displayed |
| TC-CASE-008 | Complete case with income | Case marked complete, income saved |

### 3.2 Customer Cases Screen (`CustomerCasesScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-CUST-001 | View my cases | List customer's cases |
| TC-CUST-002 | Create new case | Navigate to create form |
| TC-CUST-003 | View case bids | Show providers who bid |
| TC-CUST-004 | Cancel case | Case cancelled |

### 3.3 Create Case Screen (`CreateCaseScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-CREATE-001 | Fill all required fields | Case created successfully |
| TC-CREATE-002 | Select service category | Category saved |
| TC-CREATE-003 | Set budget range | Budget saved |
| TC-CREATE-004 | Add location | City/neighborhood saved |
| TC-CREATE-005 | Add photos | Screenshots uploaded |
| TC-CREATE-006 | Submit without required fields | Validation errors |

### API Commands - Cases
```bash
# 1. Get All Cases with Filters
curl -X GET "https://maystorfix.com/api/v1/cases?status=open&category=plumber&city=София&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# 2. Get Case Statistics
curl -X GET https://maystorfix.com/api/v1/cases/stats \
  -H "Authorization: Bearer $TOKEN"

# 3. Get Specific Case
curl -X GET https://maystorfix.com/api/v1/cases/CASE_ID \
  -H "Authorization: Bearer $TOKEN"

# 4. Create New Case (Customer)
curl -X POST https://maystorfix.com/api/v1/cases \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Спукана тръба в банята",
    "description": "Нуждая се от водопроводчик за ремонт на спукана тръба",
    "category": "plumber",
    "city": "София",
    "neighborhood": "Лозенец",
    "budgetRange": "50-100 лв",
    "urgency": "high",
    "customerName": "Иван Петров",
    "customerPhone": "+359888123456",
    "customerEmail": "ivan@test.com"
  }'

# 5. Accept Case (Provider)
curl -X POST https://maystorfix.com/api/v1/cases/CASE_ID/accept \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "YOUR_PROVIDER_ID",
    "providerName": "Георги Майстор"
  }'

# 6. Decline Case
curl -X POST https://maystorfix.com/api/v1/cases/CASE_ID/decline \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "YOUR_PROVIDER_ID",
    "reason": "Извън района ми на обслужване"
  }'

# 7. Complete Case with Income
curl -X POST https://maystorfix.com/api/v1/cases/CASE_ID/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "completionNotes": "Ремонтът е завършен успешно",
    "income": {
      "amount": 150,
      "paymentMethod": "cash",
      "notes": "Платено в брой"
    }
  }'

# 8. Update Case Status
curl -X PUT https://maystorfix.com/api/v1/cases/CASE_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "message": "Започнах работа по казуса"
  }'

# 9. Get Declined Cases
curl -X GET https://maystorfix.com/api/v1/cases/declined/YOUR_PROVIDER_ID \
  -H "Authorization: Bearer $TOKEN"

# 10. Undecline Case
curl -X POST https://maystorfix.com/api/v1/cases/CASE_ID/undecline \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"providerId": "YOUR_PROVIDER_ID"}'

# 11. Cancel Case (Customer)
curl -X POST https://maystorfix.com/api/v1/cases/CASE_ID/cancel \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. Bidding System Tests

### 4.1 Place Bid Screen (`PlaceBidScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-BID-001 | Place bid on case | Bid saved successfully |
| TC-BID-002 | Set proposed budget | Budget range saved |
| TC-BID-003 | Add bid comment | Comment attached to bid |
| TC-BID-004 | Check can bid access | Verify points available |

### 4.2 My Bids Screen (`MyBidsScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-MYBID-001 | View all my bids | List all placed bids |
| TC-MYBID-002 | Filter winning bids | Show only won bids |
| TC-MYBID-003 | View bid status | Pending/Won/Lost display |

### 4.3 Case Bids Screen (`CaseBidsScreen.tsx`) - Customer View
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-CASEBID-001 | View bids on my case | List all bids |
| TC-CASEBID-002 | Select winning bid | Provider assigned |
| TC-CASEBID-003 | View provider profile | Navigate to provider details |

### API Commands - Bidding
```bash
# 1. Check if Can Bid
curl -X GET https://maystorfix.com/api/v1/bidding/case/CASE_ID/can-bid \
  -H "Authorization: Bearer $TOKEN"

# 2. Place Bid
curl -X POST https://maystorfix.com/api/v1/bidding/case/CASE_ID/bid \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "proposed_budget_range": "100-150 лв",
    "bid_comment": "Мога да дойда днес следобед"
  }'

# 3. Get Bids for Case
curl -X GET "https://maystorfix.com/api/v1/bidding/case/CASE_ID/bids?includeProviderInfo=true" \
  -H "Authorization: Bearer $TOKEN"

# 4. Get My Bids
curl -X GET https://maystorfix.com/api/v1/bidding/my-bids \
  -H "Authorization: Bearer $TOKEN"

# 5. Select Winning Bid (Customer)
curl -X POST https://maystorfix.com/api/v1/bidding/case/CASE_ID/select-winner \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"winning_bid_id": "BID_ID"}'
```

---

## 5. Chat System Tests

### 5.1 Chat Screen (`ChatScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-CHAT-001 | View conversations list | All conversations load |
| TC-CHAT-002 | Unread message count | Badge shows count |
| TC-CHAT-003 | Tap conversation | Navigate to detail |
| TC-CHAT-004 | Last message preview | Shows in list |

### 5.2 Chat Detail Screen (`ChatDetailScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-DETAIL-001 | Send text message | Message appears in chat |
| TC-DETAIL-002 | Receive message | Message appears instantly |
| TC-DETAIL-003 | Message read status | Double check shows |
| TC-DETAIL-004 | Close conversation | Conversation marked closed |
| TC-DETAIL-005 | Request handoff | Handoff requested |

### API Commands - Chat
```bash
# 1. Get Conversations
curl -X GET https://maystorfix.com/api/v1/chat/conversations \
  -H "Authorization: Bearer $TOKEN"

# 2. Get Messages for Conversation
curl -X GET https://maystorfix.com/api/v1/chat/conversations/CONVERSATION_ID/messages \
  -H "Authorization: Bearer $TOKEN"

# 3. Send Message
curl -X POST https://maystorfix.com/api/v1/chat/conversations/CONVERSATION_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Здравейте, мога да помогна с този казус"
  }'

# 4. Mark Messages as Read
curl -X POST https://maystorfix.com/api/v1/chat/conversations/CONVERSATION_ID/read \
  -H "Authorization: Bearer $TOKEN"

# 5. Create New Conversation
curl -X POST https://maystorfix.com/api/v1/chat/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "participant_id": "OTHER_USER_ID",
    "case_id": "CASE_ID"
  }'
```

---

## 6. Points & Subscription Tests

### 6.1 Points Screen (`PointsScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-PTS-001 | View points balance | Balance displayed |
| TC-PTS-002 | View transaction history | Transactions listed |
| TC-PTS-003 | Check case access cost | Cost calculated |
| TC-PTS-004 | View accessed cases | List cases unlocked |

### 6.2 Subscription Screen (`SubscriptionScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-SUB-001 | View subscription tiers | All tiers displayed |
| TC-SUB-002 | View current subscription | Current plan highlighted |
| TC-SUB-003 | Upgrade subscription | Upgrade flow works |
| TC-SUB-004 | View tier comparison | Features compared |
| TC-SUB-005 | Cancel subscription | Cancellation confirmed |

### API Commands - Points & Subscriptions
```bash
# 1. Get Points Balance
curl -X GET https://maystorfix.com/api/v1/points/balance \
  -H "Authorization: Bearer $TOKEN"

# 2. Get Points Transactions
curl -X GET "https://maystorfix.com/api/v1/points/transactions?limit=50" \
  -H "Authorization: Bearer $TOKEN"

# 3. Check Case Access
curl -X POST https://maystorfix.com/api/v1/points/check-access \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": "CASE_ID",
    "case_budget": 150
  }'

# 4. Spend Points for Case
curl -X POST https://maystorfix.com/api/v1/points/spend \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": "CASE_ID",
    "case_budget": 150
  }'

# 5. Get Accessed Cases
curl -X GET https://maystorfix.com/api/v1/points/accessed-cases \
  -H "Authorization: Bearer $TOKEN"

# 6. Get Subscription Tiers
curl -X GET https://maystorfix.com/api/v1/subscriptions/tiers \
  -H "Authorization: Bearer $TOKEN"

# 7. Get Tier Comparison
curl -X GET https://maystorfix.com/api/v1/subscriptions/tiers/comparison \
  -H "Authorization: Bearer $TOKEN"

# 8. Get My Subscription
curl -X GET https://maystorfix.com/api/v1/subscriptions/my-subscription \
  -H "Authorization: Bearer $TOKEN"

# 9. Upgrade Subscription
curl -X POST https://maystorfix.com/api/v1/subscriptions/upgrade \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tier_id": "pro",
    "payment_method": "card",
    "auto_renew": true
  }'

# 10. Check Feature Access
curl -X GET https://maystorfix.com/api/v1/subscriptions/feature-access/unlimited_cases \
  -H "Authorization: Bearer $TOKEN"

# 11. Cancel Subscription
curl -X POST https://maystorfix.com/api/v1/subscriptions/cancel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_id": "SUB_ID",
    "reason": "Too expensive"
  }'
```

---

## 7. Location & Tracking Tests

### 7.1 Map Search Screen (`MapSearchScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-MAP-001 | Map loads | Google Map displayed |
| TC-MAP-002 | Provider markers visible | Markers on map |
| TC-MAP-003 | Tap provider marker | Provider info displayed |
| TC-MAP-004 | Locate me button | Center on user location |
| TC-MAP-005 | Radius filter works | Markers filter by distance |
| TC-MAP-006 | Category filter works | Markers filter by category |

### 7.2 Search Screen (`SearchScreen.tsx`) - Directory View
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-SEARCH-001 | Filter by category | Providers filtered |
| TC-SEARCH-002 | Filter by city | Providers in city shown |
| TC-SEARCH-003 | Filter by neighborhood | Providers in area shown |
| TC-SEARCH-004 | Navigate to provider | Provider profile opens |
| TC-SEARCH-005 | Start chat with provider | Chat screen opens |

### 7.3 Location Schedule Screen (`LocationScheduleScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-LOC-001 | Enable schedule | Schedule turns on |
| TC-LOC-002 | Set work hours | Hours saved |
| TC-LOC-003 | Toggle weekend days | Days enabled/disabled |
| TC-LOC-004 | Check schedule status | Active/inactive displayed |

### API Commands - Location & Tracking
```bash
# 1. Update Location
curl -X POST https://maystorfix.com/api/v1/tracking/update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 42.6977,
    "longitude": 23.3219,
    "heading": 180,
    "speed": 0
  }'

# 2. Clear Location
curl -X DELETE https://maystorfix.com/api/v1/tracking/location \
  -H "Authorization: Bearer $TOKEN"

# 3. Get Location Schedule
curl -X GET https://maystorfix.com/api/v1/tracking/schedule \
  -H "Authorization: Bearer $TOKEN"

# 4. Update Location Schedule
curl -X PUT https://maystorfix.com/api/v1/tracking/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule_enabled": true,
    "start_time": "08:00",
    "end_time": "18:00",
    "disable_weekends": true,
    "monday_enabled": true,
    "tuesday_enabled": true,
    "wednesday_enabled": true,
    "thursday_enabled": true,
    "friday_enabled": true,
    "saturday_enabled": false,
    "sunday_enabled": false
  }'

# 5. Check if Location Should Be Active
curl -X GET https://maystorfix.com/api/v1/tracking/schedule/check \
  -H "Authorization: Bearer $TOKEN"

# 6. Search Providers (Geospatial)
curl -X GET "https://maystorfix.com/api/v1/marketplace/providers/search?lat=42.6977&lng=23.3219&radius=10&category=plumber" \
  -H "Authorization: Bearer $TOKEN"

# 7. Get Cities
curl -X GET https://maystorfix.com/api/v1/locations/cities

# 8. Get Neighborhoods for City
curl -X GET "https://maystorfix.com/api/v1/locations/neighborhoods/София"

# 9. Search Locations
curl -X GET "https://maystorfix.com/api/v1/locations/search?q=Лозенец&type=neighborhood"
```

---

## 8. Notification Tests

### 8.1 Notifications Screen (`NotificationsScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-NOTIF-001 | View all notifications | List loads |
| TC-NOTIF-002 | Unread count badge | Count displayed |
| TC-NOTIF-003 | Mark as read | Notification marked |
| TC-NOTIF-004 | Mark all as read | All cleared |
| TC-NOTIF-005 | Tap notification | Navigate to related screen |

### API Commands - Notifications
```bash
# 1. Get Notifications
curl -X GET https://maystorfix.com/api/v1/notifications \
  -H "Authorization: Bearer $TOKEN"

# 2. Get Unread Count
curl -X GET https://maystorfix.com/api/v1/notifications/unread-count \
  -H "Authorization: Bearer $TOKEN"

# 3. Mark Single as Read
curl -X POST https://maystorfix.com/api/v1/notifications/NOTIFICATION_ID/read \
  -H "Authorization: Bearer $TOKEN"

# 4. Mark All as Read
curl -X POST https://maystorfix.com/api/v1/notifications/mark-all-read \
  -H "Authorization: Bearer $TOKEN"

# 5. Create Test Notification
curl -X POST https://maystorfix.com/api/v1/notifications/test \
  -H "Authorization: Bearer $TOKEN"

# 6. Register Device Token (FCM)
curl -X POST https://maystorfix.com/api/v1/device-tokens/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "FCM_TOKEN_HERE",
    "platform": "android"
  }'

# 7. Test Push Notification
curl -X POST https://maystorfix.com/api/v1/device-tokens/test \
  -H "Authorization: Bearer $TOKEN"
```

---

## 9. Review System Tests

### 9.1 Provider Profile Screen (`ProviderProfileScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-REV-001 | View provider reviews | Reviews listed |
| TC-REV-002 | View average rating | Stars displayed |
| TC-REV-003 | Submit review | Review saved |

### API Commands - Reviews
```bash
# 1. Create Review
curl -X POST https://maystorfix.com/api/v1/reviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": "CASE_ID",
    "provider_id": "PROVIDER_ID",
    "rating": 5,
    "comment": "Отлична работа! Препоръчвам!"
  }'

# 2. Get Provider Reviews
curl -X GET https://maystorfix.com/api/v1/reviews/provider/PROVIDER_ID

# 3. Get Provider Review Stats
curl -X GET https://maystorfix.com/api/v1/reviews/provider/PROVIDER_ID/stats

# 4. Check if Can Review
curl -X GET https://maystorfix.com/api/v1/reviews/case/CASE_ID/can-review \
  -H "Authorization: Bearer $TOKEN"

# 5. Get Pending Reviews
curl -X GET https://maystorfix.com/api/v1/reviews/pending \
  -H "Authorization: Bearer $TOKEN"

# 6. Request Review from Customer
curl -X POST https://maystorfix.com/api/v1/reviews/request \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": "CASE_ID",
    "customer_email": "customer@test.com"
  }'
```

---

## 10. Marketplace & Search Tests

### 10.1 Service Categories
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-MKTPL-001 | Get categories | All categories listed |
| TC-MKTPL-002 | Select category | Providers filtered |

### API Commands - Marketplace
```bash
# 1. Get Service Categories
curl -X GET https://maystorfix.com/api/v1/marketplace/categories

# 2. Search Providers
curl -X GET "https://maystorfix.com/api/v1/marketplace/providers/search?category=plumber&city=София"

# 3. Get Provider Details
curl -X GET https://maystorfix.com/api/v1/marketplace/providers/PROVIDER_ID

# 4. Get Cities
curl -X GET https://maystorfix.com/api/v1/marketplace/locations/cities

# 5. Get Neighborhoods
curl -X GET "https://maystorfix.com/api/v1/marketplace/locations/neighborhoods?city=София"
```

---

## 11. Referral System Tests

### 11.1 Referral Dashboard Screen (`ReferralDashboardScreen.tsx`)
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-REF-001 | View referral code | Code displayed |
| TC-REF-002 | Share referral link | Share dialog opens |
| TC-REF-003 | View referral stats | Progress shown |
| TC-REF-004 | View rewards | Available rewards listed |
| TC-REF-005 | Claim reward | Reward applied |

### API Commands - Referrals
```bash
# 1. Get Referral Code
curl -X GET https://maystorfix.com/api/v1/referrals/code \
  -H "Authorization: Bearer $TOKEN"

# 2. Get Referral Dashboard
curl -X GET https://maystorfix.com/api/v1/referrals/dashboard \
  -H "Authorization: Bearer $TOKEN"

# 3. Get Aggregate Progress
curl -X GET https://maystorfix.com/api/v1/referrals/aggregate-progress \
  -H "Authorization: Bearer $TOKEN"

# 4. Validate Referral Code
curl -X GET https://maystorfix.com/api/v1/referrals/validate/REFERRAL_CODE

# 5. Get Available Rewards
curl -X GET https://maystorfix.com/api/v1/referrals/rewards \
  -H "Authorization: Bearer $TOKEN"

# 6. Apply Reward
curl -X POST https://maystorfix.com/api/v1/referrals/rewards/REWARD_ID/apply \
  -H "Authorization: Bearer $TOKEN"
```

---

## Additional API Endpoints

### Dashboard Stats
```bash
curl -X GET "https://maystorfix.com/api/v1/dashboard/stats?userId=USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Income Tracking
```bash
# Get Income Stats
curl -X GET https://maystorfix.com/api/v1/income/provider/PROVIDER_ID \
  -H "Authorization: Bearer $TOKEN"

# Get Income Years
curl -X GET https://maystorfix.com/api/v1/income/provider/PROVIDER_ID/years \
  -H "Authorization: Bearer $TOKEN"

# Get Income by Month
curl -X GET https://maystorfix.com/api/v1/income/provider/PROVIDER_ID/month/2024-01 \
  -H "Authorization: Bearer $TOKEN"

# Get Income by Payment Method
curl -X GET https://maystorfix.com/api/v1/income/provider/PROVIDER_ID/method/cash \
  -H "Authorization: Bearer $TOKEN"
```

### App Version
```bash
curl -X GET https://maystorfix.com/api/v1/app/version
```

### SMS Configuration
```bash
# Get SMS Settings
curl -X GET https://maystorfix.com/api/v1/sms/settings \
  -H "Authorization: Bearer $TOKEN"

# Update SMS Template
curl -X PUT https://maystorfix.com/api/v1/sms/template \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template": "Благодаря за обаждането! Ще ви се обадя скоро."}'
```

### GDPR
```bash
# Get Privacy Notice
curl -X GET https://maystorfix.com/api/v1/gdpr/privacy-notice

# Get User Data (Data Portability)
curl -X GET https://maystorfix.com/api/v1/gdpr/export \
  -H "Authorization: Bearer $TOKEN"

# Delete User Data (Right to Erasure)
curl -X DELETE https://maystorfix.com/api/v1/gdpr/delete \
  -H "Authorization: Bearer $TOKEN"
```

---

## Quick Test Script

Save this as `test-apis.sh`:

```bash
#!/bin/bash

BASE_URL="https://maystorfix.com/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=== ServiceTextPro API Test Suite ==="
echo ""

# 1. Health Check
echo "1. Testing Health Check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health)
if [ "$HEALTH" == "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed (HTTP $HEALTH)${NC}"
fi

# 2. Login
echo ""
echo "2. Testing Login..."
read -p "Enter email: " EMAIL
read -sp "Enter password: " PASSWORD
echo ""

RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $RESPONSE | jq -r '.data.tokens.accessToken')
USER_ID=$(echo $RESPONSE | jq -r '.data.user.id')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓ Login successful${NC}"
    echo "User ID: $USER_ID"
else
    echo -e "${RED}✗ Login failed${NC}"
    echo $RESPONSE | jq .
    exit 1
fi

# 3. Get Current User
echo ""
echo "3. Testing Get Current User..."
RESPONSE=$(curl -s -X GET $BASE_URL/auth/me \
  -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✓ Get user passed${NC}"
else
    echo -e "${RED}✗ Get user failed${NC}"
fi

# 4. Get Cases
echo ""
echo "4. Testing Get Cases..."
RESPONSE=$(curl -s -X GET "$BASE_URL/cases?limit=5" \
  -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
    CASE_COUNT=$(echo $RESPONSE | jq '.data.cases | length')
    echo -e "${GREEN}✓ Get cases passed ($CASE_COUNT cases)${NC}"
else
    echo -e "${RED}✗ Get cases failed${NC}"
fi

# 5. Get Conversations
echo ""
echo "5. Testing Get Conversations..."
RESPONSE=$(curl -s -X GET $BASE_URL/chat/conversations \
  -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✓ Get conversations passed${NC}"
else
    echo -e "${RED}✗ Get conversations failed${NC}"
fi

# 6. Get Notifications
echo ""
echo "6. Testing Get Notifications..."
RESPONSE=$(curl -s -X GET $BASE_URL/notifications \
  -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✓ Get notifications passed${NC}"
else
    echo -e "${RED}✗ Get notifications failed${NC}"
fi

# 7. Get Points Balance
echo ""
echo "7. Testing Get Points Balance..."
RESPONSE=$(curl -s -X GET $BASE_URL/points/balance \
  -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
    BALANCE=$(echo $RESPONSE | jq -r '.data.balance')
    echo -e "${GREEN}✓ Get points passed (Balance: $BALANCE)${NC}"
else
    echo -e "${RED}✗ Get points failed${NC}"
fi

echo ""
echo "=== Test Suite Complete ==="
```

Make executable and run:
```bash
chmod +x test-apis.sh
./test-apis.sh
```

---

## Test Environment Notes

- **Production API**: `https://maystorfix.com/api/v1`
- **All endpoints require HTTPS**
- **Most endpoints require Bearer token authentication**
- **Rate limits apply (500 requests/minute for auth endpoints)**
- **Response format**: `{ success: boolean, data: {...}, error?: {...} }`
