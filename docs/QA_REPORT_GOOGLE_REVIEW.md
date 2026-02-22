# Manual QA Test Report — ServiceTextPro

**Application:** ServiceTextPro  
**Package:** `com.servicetextpro`  
**Version:** 1.13 (versionCode 15)  
**Platform:** Android (minSdk per project config, targetSdk latest)  
**Test Date:** February 6, 2026  
**Tester:** QA Team  
**Backend:** https://snapfix.bg/api/v1  
**Web:** https://snapfix.bg  

---

## 1. Overview

ServiceTextPro is a marketplace platform connecting customers with local service providers (tradespeople) in Bulgaria. The app supports two user roles:

- **Customer** — searches for service providers, creates service cases (inquiries), communicates via in-app chat, and leaves reviews after case completion.
- **Service Provider (SP)** — receives and manages service cases, communicates with customers, tracks income/statistics, and uses the automated SMS feature to handle missed calls.

This report covers manual QA testing of the following core features:

1. Map Features (SP & Customer)
2. SMS Sent Feature
3. SP Review System
4. Chat
5. Case Creation / Close
6. SP Search

---

## 2. Test Environment

| Item | Detail |
|------|--------|
| Device | Android physical device / emulator |
| OS | Android 12+ |
| Network | Wi-Fi / Mobile Data |
| Backend | Production (snapfix.bg) |
| Auth | Email + password login |
| Permissions | Location, Phone State, Call Log, Contacts, Notifications |

---

## 3. Feature Test Cases

---

### 3.1 Map Features (Customer & SP)

**Screen:** `MapSearchScreen`  
**Description:** Interactive Google Maps view showing service providers (for customers) or available cases (for SPs) based on the user's location and filters.

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.1.1 | Map loads with user location | 1. Open the app as Customer. 2. Navigate to the Map tab. 3. Grant location permission if prompted. | Map displays centered on user's current location with provider markers visible. | **PASS** |
| 3.1.2 | Provider markers display on map (Customer) | 1. Open Map tab as Customer. 2. Observe markers on the map. | Provider markers appear with correct icons. Tapping a marker shows provider preview card with name, category, and rating. | **PASS** |
| 3.1.3 | Case markers display on map (SP) | 1. Log in as Service Provider. 2. Open Map tab. | Map switches to SP mode showing available case markers in the area. Tapping a case marker shows case preview with title, category, and budget range. | **PASS** |
| 3.1.4 | Filter by category | 1. Open Map tab. 2. Tap the filter icon. 3. Select a service category (e.g., "Електричество"). | Only providers/cases matching the selected category are displayed. Markers update in real-time. | **PASS** |
| 3.1.5 | Filter by radius | 1. Open Map tab. 2. Tap the filter icon. 3. Adjust the search radius slider. | Providers/cases outside the selected radius are hidden. Map zoom adjusts accordingly. | **PASS** |
| 3.1.6 | Toggle Map / List view | 1. Open Map tab. 2. Tap the "List" toggle button. | View switches to a scrollable list of providers/cases. Tapping "Map" returns to map view. | **PASS** |
| 3.1.7 | Provider profile modal (Customer) | 1. Tap a provider marker or list item. 2. Tap "View Profile". | Full profile modal opens showing: business name, category, rating, gallery photos, reviews with detailed category ratings (Качество, Комуникация, В срок, Цена/Качество), and an inquiry button. | **PASS** |
| 3.1.8 | SP bids on case from map | 1. Log in as SP. 2. Open Map tab. 3. Tap a case marker. 4. Tap "Place Bid". | Bid form opens. SP can enter amount, message, and submit. Confirmation alert appears on success. | **PASS** |
| 3.1.9 | Free inspection toggle (Customer) | 1. Open Map tab as Customer. 2. Toggle "Show only free inspection" filter. | Only providers offering free inspection are displayed. | **PASS** |
| 3.1.10 | Map interaction — zoom/pan | 1. Open Map tab. 2. Pinch to zoom, drag to pan. | Map responds smoothly. New providers/cases load when the visible region changes. | **PASS** |

---

### 3.2 SMS Sent Feature

**Screen:** `SMSScreen`  
**Description:** Automated SMS auto-reply service for Service Providers. When an SP receives a phone call they cannot answer, the system detects the missed call and sends an automated SMS to the caller via the Twilio backend, containing a chat link.

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.2.1 | SMS screen loads | 1. Log in as SP. 2. Navigate to SMS tab. | SMS screen displays with: enable/disable toggle, template selection (Latin/Bulgarian/Custom), SMS count, points status, and current message preview with chat link. | **PASS** |
| 3.2.2 | Enable SMS auto-reply | 1. Open SMS screen. 2. Toggle SMS to ON. 3. Grant required permissions (Phone State, Call Log) if prompted. | Toggle turns ON. Permissions are granted. Foreground service notification appears confirming call detection is active. | **PASS** |
| 3.2.3 | SMS template selection — Latin | 1. Select "Латиница (1 SMS)" template. 2. Tap Save. | Template updates to Latin text. Preview shows the Latin message with the chat link substituted. Saves to backend. | **PASS** |
| 3.2.4 | SMS template selection — Bulgarian | 1. Select "Кирилица (2 SMS)" template. 2. Tap Save. | Template updates to Bulgarian Cyrillic text. SMS segment calculator shows 2 SMS segments (due to Unicode). | **PASS** |
| 3.2.5 | SMS template — Custom | 1. Select "Персонализиран" template. 2. Type a custom message including `[chat_link]` placeholder. 3. Tap Save. | Custom message is saved. Preview shows the custom text with the actual chat link replacing the placeholder. | **PASS** |
| 3.2.6 | Missed call triggers SMS | 1. Enable SMS auto-reply. 2. Call the SP's phone from another device. 3. Let the call go unanswered (miss it). | After the missed call is detected, the system sends an SMS to the caller's number via Twilio. SMS count increments. The caller receives the SMS with the chat link. | **PASS** |
| 3.2.7 | Filter known contacts | 1. Toggle "Filter known contacts" ON. 2. Grant Contacts permission if prompted. 3. Call from a number saved in the SP's contacts. | SMS is NOT sent to known contacts. Only unknown callers receive the auto-reply. | **PASS** |
| 3.2.8 | SMS points deduction | 1. Check current points balance. 2. Trigger a missed call SMS. 3. Check points balance again. | Points are deducted per the tier's SMS cost. Points status updates in real-time. If points are insufficient, an alert is shown and the SMS is not sent. | **PASS** |
| 3.2.9 | Chat link generation | 1. Open SMS screen for the first time. | A unique chat link is auto-generated for the SP. The link opens a web-based chat interface when clicked by the caller. | **PASS** |
| 3.2.10 | Disable SMS auto-reply | 1. Toggle SMS to OFF. | Call detection service stops. Foreground notification is removed. No SMS is sent on subsequent missed calls. | **PASS** |
| 3.2.11 | Permission revocation handling | 1. Enable SMS. 2. Go to Android Settings > Apps > ServiceTextPro > Permissions. 3. Revoke Phone permission. 4. Return to the app. | App detects revoked permissions, auto-disables SMS, and shows an alert explaining why SMS was turned off. | **PASS** |
| 3.2.12 | Real-time sync with web | 1. Enable/disable SMS from the web marketplace dashboard. 2. Open the SMS screen in the app. | SMS status syncs from backend. The toggle reflects the current state set from the web. | **PASS** |

---

### 3.3 SP Review System

**Screen:** `StatisticsScreen` (SP side), `CaseBidsScreen` / `SearchScreen` / `MapSearchScreen` (Customer side)  
**Description:** After a case is completed, the customer can leave a review for the Service Provider. Reviews include an overall rating (1-5 stars) and detailed category ratings.

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.3.1 | Customer submits review | 1. Complete a case as Customer. 2. A survey/review prompt appears in chat or on the case card. 3. Rate overall (1-5 stars). 4. Rate categories: Качество, Комуникация, В срок, Цена/Качество. 5. Toggle "Would recommend". 6. Add a comment. 7. Submit. | Review is saved successfully. Confirmation message appears. The SP's average rating is updated. | **PASS** |
| 3.3.2 | Duplicate review prevention | 1. Try to submit a second review for the same case. | Error message: review already exists for this case. Duplicate submission is blocked. | **PASS** |
| 3.3.3 | Review display — Customer view (Search) | 1. Open Search tab as Customer. 2. Tap a provider to view profile. 3. Scroll to Reviews section. | Reviews display with: customer name, overall star rating, category ratings (🔧 Качество, 💬 Комуникация, ⏱ В срок, 💰 Цена/Качество), recommendation badge (👍/👎), comment text, and date. | **PASS** |
| 3.3.4 | Review display — Customer view (Map) | 1. Open Map tab. 2. Tap a provider marker > View Profile. 3. Scroll to Reviews section. | Same detailed review display as in Search. Up to 5 reviews shown. | **PASS** |
| 3.3.5 | Review display — Customer view (Bids) | 1. Open a case with bids. 2. Tap a bidding SP's profile. 3. Scroll to Reviews section. | Detailed reviews with all category ratings displayed correctly. | **PASS** |
| 3.3.6 | Review display — SP view (Statistics) | 1. Log in as SP. 2. Navigate to Statistics screen. 3. Tap the rating/reviews card to open the reviews modal. | Modal shows all received reviews with: customer name, overall stars, category breakdown (Качество, Комуникация, В срок, Цена/Качество), recommendation badge, comment, and date. | **PASS** |
| 3.3.7 | Review display — Web provider profile | 1. Open `https://snapfix.bg/provider/{id}` in a browser. 2. Scroll to the Reviews section. | Reviews carousel shows cards with detailed category pills (color-coded), recommendation text, comment, and date. No duplicate cards. If ≤3 reviews, cards are displayed statically centered. If >3, auto-scroll with hover-pause and drag support. | **PASS** |
| 3.3.8 | Rating calculation | 1. Submit multiple reviews for an SP with varying ratings. 2. Check the SP's profile. | Average rating is correctly calculated and displayed with half-star precision. Total review count is accurate. | **PASS** |

---

### 3.4 Chat

**Screen:** `ChatScreen` (list), `ChatDetailScreen` (conversation)  
**Description:** Real-time in-app messaging between customers and service providers. Chat is initiated when a case is accepted or via the SMS chat link.

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.4.1 | Chat list loads | 1. Open the Chat tab. | Conversation list displays with: contact name, last message preview, timestamp, and unread badge count. | **PASS** |
| 3.4.2 | Open conversation | 1. Tap a conversation in the list. | Chat detail screen opens. Full message history loads with correct sender attribution (left/right alignment). | **PASS** |
| 3.4.3 | Send text message | 1. Open a conversation. 2. Type a message. 3. Tap Send. | Message appears immediately in the chat. Recipient receives the message in real-time via WebSocket. | **PASS** |
| 3.4.4 | Receive message in real-time | 1. Open a conversation on Device A. 2. Send a message from Device B (or web). | Message appears on Device A without manual refresh. Chat list updates with new last message preview. | **PASS** |
| 3.4.5 | Unread message badge | 1. Receive a new message while on a different screen. 2. Navigate to the Chat tab. | Unread badge shows the correct count on the conversation. Badge clears when conversation is opened. | **PASS** |
| 3.4.6 | Chat from SMS link | 1. SP receives a missed call. 2. Caller receives SMS with chat link. 3. Caller opens the link in a browser. 4. Caller types a message. | A new conversation is created between the caller and the SP. The SP sees the new conversation in the Chat tab. | **PASS** |
| 3.4.7 | Data sharing consent check | 1. Log in as a user who has NOT granted data_sharing consent. 2. Open the Chat tab. | A consent overlay is shown, preventing access to chat until consent is granted. | **PASS** |
| 3.4.8 | Pull-to-refresh | 1. Open Chat tab. 2. Pull down to refresh. | Conversation list refreshes, loading the latest data from the server. | **PASS** |
| 3.4.9 | Empty state | 1. Log in as a new user with no conversations. 2. Open Chat tab. | Empty state screen shows with message "Няма разговори" and guidance text. | **PASS** |
| 3.4.10 | Chat persistence | 1. Send messages in a conversation. 2. Close and reopen the app. | Previous messages are fully loaded from the server. No data loss. | **PASS** |

---

### 3.5 Case Creation / Close

**Screens:** `CreateCaseScreen` (creation), `CasesScreen` (SP management), `CustomerCasesScreen` (Customer management)  
**Description:** Customers create service request cases. SPs view, accept/decline, bid on, and complete cases.

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.5.1 | Create case — basic flow | 1. Log in as Customer. 2. Navigate to Create Case (via Search or Map "Submit Inquiry" button). 3. Fill in: title, description, category, city, address, budget range. 4. Tap Submit. | Case is created successfully. Confirmation alert appears. Case appears in Customer's case list and in the SP queue. | **PASS** |
| 3.5.2 | Create case — with photos | 1. Start creating a case. 2. Tap "Add Photos". 3. Select photos from gallery or camera. 4. Submit the case. | Photos are uploaded and attached to the case. They are visible in the case detail view. | **PASS** |
| 3.5.3 | Create case — direct assignment | 1. Open an SP's profile from Search or Map. 2. Tap "Пусни запитване" (Submit Inquiry). | Case creation form opens pre-filled with the SP's category. On submission, the case is directly assigned to the selected SP. | **PASS** |
| 3.5.4 | Create case — validation | 1. Try to submit a case with empty required fields (no title, no category). | Validation errors are shown. Form cannot be submitted until all required fields are filled. | **PASS** |
| 3.5.5 | SP views available cases | 1. Log in as SP. 2. Open the Cases tab. 3. Select "Налични" (Available) view. | List of pending, unassigned cases matching the SP's service area is displayed. Cases show: title, category, budget, city (neighborhood only — full address masked). | **PASS** |
| 3.5.6 | SP accepts a case | 1. View an available case. 2. Tap "Приеми" (Accept). 3. Confirm in the alert dialog. | Case status changes to "Accepted". Case moves to SP's assigned list. Points are deducted if applicable. Customer is notified. | **PASS** |
| 3.5.7 | SP declines a case | 1. View an available case. 2. Tap "Откажи" (Decline). 3. Confirm. | Case is removed from SP's available list. It moves to the "Declined" tab. Case remains available for other SPs. | **PASS** |
| 3.5.8 | SP places a bid | 1. View an available case. 2. Tap "Place Bid". 3. Enter bid amount and message. 4. Submit. | Bid is created. Confirmation shown. Case moves to SP's "Bids" tab. Customer sees the bid in their case bids screen. | **PASS** |
| 3.5.9 | SP completes a case | 1. Open an assigned/in-progress case. 2. Tap "Завърши" (Complete). 3. Enter income amount, payment method. 4. Confirm. | Case status changes to "Completed". Income is recorded. Customer receives a review survey prompt. | **PASS** |
| 3.5.10 | Customer views their cases | 1. Log in as Customer. 2. Open Customer Dashboard > Cases. | List of customer's cases with status badges (Pending, Accepted, Completed). Tapping a case shows full details. | **PASS** |
| 3.5.11 | Case filters — category, budget, city | 1. Open Cases tab as SP. 2. Use the category, budget range, and city dropdown filters. | Case list filters correctly. Multiple category selection is supported. Budget ranges match the defined tiers. | **PASS** |
| 3.5.12 | Address masking for SPs | 1. View an available case as SP. | Only the neighborhood/district is shown. Full street address is hidden until the case is accepted, protecting customer privacy. | **PASS** |
| 3.5.13 | SP reviews direct assignment | 1. Customer creates a direct-assignment case for an SP. 2. SP opens Cases tab > "Pending Reviews" section. | SP sees the pending assignment with options: Accept, Decline, or Counter-offer. | **PASS** |

---

### 3.6 SP Search

**Screen:** `SearchScreen`  
**Description:** Allows customers to search for service providers by category, city, and neighborhood using dropdown filters.

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.6.1 | Search screen loads | 1. Log in as Customer. 2. Navigate to the Search tab. | Search screen loads with category, city, and neighborhood filter dropdowns. Provider list area is ready. | **PASS** |
| 3.6.2 | Filter by category | 1. Select a service category (e.g., "ВиК"). | Provider list updates to show only providers in the selected category. | **PASS** |
| 3.6.3 | Filter by city | 1. Select a city (e.g., "София"). | Provider list filters to show only providers operating in the selected city. Neighborhood dropdown populates with neighborhoods for the chosen city. | **PASS** |
| 3.6.4 | Filter by neighborhood | 1. Select a city, then select a neighborhood. | Provider list narrows further to show only providers in the selected neighborhood. | **PASS** |
| 3.6.5 | Provider card display | 1. Perform a search with filters. | Each provider card shows: business name, service category (in Bulgarian), star rating, review count, and profile image (if available). | **PASS** |
| 3.6.6 | Open provider profile | 1. Tap a provider card in the search results. | Full profile modal opens showing: business name, description, service category, contact area, gallery photos, star rating, and detailed reviews with category breakdowns. | **PASS** |
| 3.6.7 | Submit inquiry from search | 1. Open a provider profile. 2. Tap "Пусни запитване" (Submit Inquiry). | Navigation to Create Case screen with the provider pre-selected and category pre-filled. | **PASS** |
| 3.6.8 | VIP providers highlighted | 1. Search with any filter. | VIP providers (if any) are displayed in a separate highlighted section at the top of the results. | **PASS** |
| 3.6.9 | Empty results | 1. Search for a category/city combination with no providers. | Empty state message displayed: no providers found for the selected filters. | **PASS** |
| 3.6.10 | Search performance | 1. Rapidly change filters multiple times. | No crashes, no duplicate requests stacking. Loading indicator shows during fetch. Results update cleanly. | **PASS** |

---

## 4. Permissions Summary

The app requests the following Android permissions, each tied to a specific feature:

| Permission | Feature | Justification |
|------------|---------|---------------|
| `INTERNET` | All features | API communication with backend server |
| `READ_CALL_LOG` | SMS Auto-Reply | Detect missed calls to trigger automated SMS |
| `READ_PHONE_STATE` | SMS Auto-Reply | Monitor phone state changes (ringing → missed) |
| `READ_PHONE_NUMBERS` | SMS Auto-Reply | Identify caller number for SMS delivery (Android 15+) |
| `ANSWER_PHONE_CALLS` | SMS Auto-Reply | Enhanced call detection on Android 15+ |
| `READ_CONTACTS` | SMS Filter | Optional: filter known contacts from SMS auto-reply |
| `CALL_PHONE` | Quick Call | Allow SP to call customers directly from the app |
| `ACCESS_FINE_LOCATION` | Map Features | Show user's location on map, proximity search |
| `ACCESS_COARSE_LOCATION` | Map Features | Approximate location for area-based searches |
| `POST_NOTIFICATIONS` | Push Notifications | Notify users of new messages, case updates, bids |
| `FOREGROUND_SERVICE` | SMS Auto-Reply | Run call detection in background |
| `FOREGROUND_SERVICE_SPECIAL_USE` | SMS Auto-Reply | Foreground service for call monitoring |
| `RECEIVE_BOOT_COMPLETED` | SMS Auto-Reply | Restart call detection after device reboot |
| `WAKE_LOCK` | SMS Auto-Reply | Keep service active during call detection |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | SMS Auto-Reply | Prevent OS from killing the call detection service |
| `VIBRATE` | Notifications | Haptic feedback for notifications |
| `USE_FULL_SCREEN_INTENT` | Notifications | Display high-priority notifications |


---

## 5. Data Privacy & Consent

- **GDPR Compliant:** Users must accept Terms of Service and Privacy Policy during registration.
- **Data Sharing Consent:** A separate `data_sharing` consent is required before accessing Chat features. If not granted, a consent overlay blocks access.
- **Data Rights:** Users can view and manage their data rights via the `DataRightsScreen`.
- **Address Masking:** Customer addresses are masked (only neighborhood shown) to SPs until a case is accepted, protecting customer privacy.
- **No Phone Number Exposure:** SP phone numbers are not displayed to customers. Contact is only possible through the in-app inquiry/chat system.

---

## 6. Test Summary

| Feature Area | Total Tests | Passed | Failed | Notes |
|-------------|-------------|--------|--------|-------|
| Map Features (SP & Customer) | 10 | 10 | 0 | Both roles tested |
| SMS Sent Feature | 12 | 12 | 0 | Twilio-based, server-side SMS |
| SP Review System | 8 | 8 | 0 | Category ratings verified |
| Chat | 10 | 10 | 0 | Real-time WebSocket tested |
| Case Creation / Close | 13 | 13 | 0 | Full lifecycle covered |
| SP Search | 10 | 10 | 0 | Filters and profile modal |
| **TOTAL** | **63** | **63** | **0** | |

---

## 7. Conclusion

All 63 test cases across 6 core feature areas have been executed and passed successfully. The application demonstrates stable functionality for both Customer and Service Provider user roles. Core business flows — provider search, case creation, case management, real-time chat, SMS auto-reply, and review submission — are all functioning as expected.

The application handles permissions responsibly, requests only what is necessary for each feature, and degrades gracefully when permissions are revoked. Data privacy measures including address masking, consent gates, and server-side SMS (no on-device SMS sending) are in place.

---

*Report prepared by: QA Team — ServiceTextPro*  
*Date: February 6, 2026*
