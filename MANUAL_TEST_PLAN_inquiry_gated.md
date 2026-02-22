# Manual Test Plan — Inquiry-Gated Contact System

**Date:** Feb 6, 2026  
**Version:** Post-implementation  
**Goal:** Verify that phone numbers and chat are hidden from all public-facing views, and "Заявка"/"Запитване" buttons correctly open case creation with provider-specific assignment.

---

## Prerequisites

- **Web:** Open https://snapfix.bg in a browser
- **Mobile:** Install latest APK on test device
- **Test accounts:**
  - Customer account (role: customer)
  - SP/Tradesperson account (role: tradesperson)
- **Both accounts should have phone numbers set in their profiles**

---

## A. Backend — Phone Number Stripping

### A1. Map API (`/free-inspection/providers`)
1. Open browser DevTools → Network tab
2. Navigate to https://snapfix.bg/map
3. Find the API call to `/free-inspection/providers`
4. ✅ **VERIFY:** Response JSON does NOT contain `phoneNumber` for any provider
5. ✅ **VERIFY:** Other fields (businessName, rating, latitude, etc.) still present

### A2. Search API (`/marketplace/search`)
1. Navigate to https://snapfix.bg/search
2. Find the API call to `/marketplace/search` in Network tab
3. ✅ **VERIFY:** Response JSON does NOT contain `phoneNumber` or `profilePhone` for any provider

### A3. Provider Profile API (`/marketplace/provider/:id`)
1. As **customer**: Navigate to any SP profile page `/provider/{id}`
2. Find the API call to `/marketplace/provider/{id}` in Network tab
3. ✅ **VERIFY:** `phoneNumber` and `profilePhone` are `undefined` / not present
4. As **SP viewing own profile**: Navigate to own profile page
5. ✅ **VERIFY:** `phoneNumber` and `profilePhone` ARE present in the response

---

## B. Web Map Page (`/map`)

### B1. Sidebar — No Phone, Has "Заявка"
1. Log in as **customer**
2. Navigate to https://snapfix.bg/map
3. Wait for providers to load in the sidebar list
4. ✅ **VERIFY:** No phone numbers shown on any provider card in sidebar
5. ✅ **VERIFY:** Each provider card has a purple "📋 Заявка" button
6. ✅ **VERIFY:** "Заявка" button does NOT appear on your own card (if you're also an SP)

### B2. Sidebar — "Заявка" Opens Modal
1. Click "📋 Заявка" on a provider card
2. ✅ **VERIFY:** `UnifiedCaseModal` opens with provider name pre-filled
3. ✅ **VERIFY:** Modal has service type, description, budget, location fields
4. Fill in the form and submit
5. ✅ **VERIFY:** Success message mentions the specific provider name
6. ✅ **VERIFY:** Modal closes after success

### B3. InfoWindow — No Phone, "Заявка" Instead of "Чат"
1. Click a provider marker on the map
2. ✅ **VERIFY:** InfoWindow popup does NOT show phone number
3. ✅ **VERIFY:** InfoWindow has "Виж профил" and "📋 Заявка" buttons (NO "Чат" link)
4. Click "📋 Заявка" from the InfoWindow
5. ✅ **VERIFY:** Case modal opens correctly

### B4. Provider View (as SP)
1. Log in as **SP/tradesperson**
2. Navigate to https://snapfix.bg/map
3. ✅ **VERIFY:** Map shows cases (green markers), not providers
4. ✅ **VERIFY:** No "Заявка" buttons shown (SP shouldn't create cases for other SPs)

---

## C. Web Search Page (`/search`)

### C1. No Phone, No "Чат", Only "Заявка"
1. Log in as **customer**
2. Navigate to https://snapfix.bg/search
3. Wait for providers to load
4. ✅ **VERIFY:** No phone numbers displayed on any provider card
5. ✅ **VERIFY:** No "Чат" button on any provider card
6. ✅ **VERIFY:** "📋 Заявка" button present on each card (except own profile)

### C2. "Заявка" Creates Case
1. Click "📋 Заявка" on a provider card
2. ✅ **VERIFY:** Case modal opens with provider info pre-filled
3. Fill form and submit
4. ✅ **VERIFY:** Success message appears
5. ✅ **VERIFY:** Case appears in customer dashboard

---

## D. Web Provider Profile (`/provider/[id]`)

### D1. Phone Hidden for Visitors
1. Log in as **customer**
2. Navigate to any SP profile: `/provider/{sp-id}`
3. ✅ **VERIFY:** Contact card does NOT show phone number (📞 row absent)
4. ✅ **VERIFY:** Quick Info section does NOT show "Телефон" row
5. ✅ **VERIFY:** Email and website still visible

### D2. Phone Visible on Own Profile
1. Log in as **SP**
2. Navigate to own profile: `/provider/{own-id}`
3. ✅ **VERIFY:** Contact card DOES show phone number
4. ✅ **VERIFY:** Quick Info section DOES show "Телефон" row
5. ✅ **VERIFY:** "Това е вашият профил" message shown instead of inquiry button

### D3. "Пусни запитване" Button
1. Log in as **customer**
2. Navigate to any SP profile
3. ✅ **VERIFY:** Button says "📋 Пусни запитване" (not "Изпрати съобщение")
4. Click the button
5. ✅ **VERIFY:** Redirects to `/create-case` with `providerId`, `providerName`, `providerCategory` query params
6. ✅ **VERIFY:** Create case page loads with provider info

---

## E. Mobile App — MapSearchScreen

### E1. Provider Preview Card
1. Open app as **customer**
2. Go to Map tab
3. Wait for providers to load, tap a marker
4. ✅ **VERIFY:** Preview card shows "Виж профил" and "Запитване" buttons (NO "Чат")

### E2. Provider List View
1. Tap "Списък" to switch to list view
2. ✅ **VERIFY:** Each provider card has "Запитване" button (NO "Чат")
3. Tap "Запитване" on a provider
4. ✅ **VERIFY:** Navigates to CreateCaseScreen with header showing "Запитване към {ProviderName}"

### E3. Profile Modal — No Phone, "Пусни запитване"
1. Tap "Виж профил" on a provider card
2. ✅ **VERIFY:** Profile modal opens
3. ✅ **VERIFY:** Quick Info section shows Опит, Проекти, Град (NO Телефон)
4. ✅ **VERIFY:** Action buttons: only "📋 Пусни запитване" (NO "📞 Обади се", NO "💬 Чат")
5. Tap "📋 Пусни запитване"
6. ✅ **VERIFY:** Modal closes and navigates to CreateCaseScreen

---

## F. Mobile App — SearchScreen

### F1. Provider Cards
1. Open app as **customer**
2. Go to Search tab, search for a category or city
3. ✅ **VERIFY:** Each provider card has "Запитване" button (NO "Чат")
4. Tap "Запитване"
5. ✅ **VERIFY:** Navigates to CreateCaseScreen

### F2. VIP Provider Cards
1. If VIP providers appear at the top
2. ✅ **VERIFY:** VIP card also has "Запитване" button (NO "Чат")
3. Tap "Запитване" on VIP card
4. ✅ **VERIFY:** Navigates to CreateCaseScreen with provider info

### F3. Profile Modal
1. Tap "Виж профил" on any provider
2. ✅ **VERIFY:** Quick Info: Опит, Проекти, Град (NO Телефон)
3. ✅ **VERIFY:** Actions: only "📋 Пусни запитване" (NO "Обади се", NO "Чат")
4. Tap "📋 Пусни запитване"
5. ✅ **VERIFY:** Navigates to CreateCaseScreen

---

## G. Mobile App — CreateCaseScreen (Provider-Specific Flow)

### G1. Header & Pre-fill
1. Navigate to CreateCaseScreen via "Запитване" from map/search
2. ✅ **VERIFY:** Header says "Запитване към {ProviderName}"
3. ✅ **VERIFY:** Subtitle says "Опишете от какво имате нужда и изпратете запитване"
4. ✅ **VERIFY:** Service type dropdown is pre-filled with provider's category

### G2. Submit Specific Case
1. Fill in description, address, phone, budget
2. Tap submit
3. ✅ **VERIFY:** Success alert says "Заявката е изпратена към {ProviderName}! Той може да приеме, откаже или предложи друг бюджет."
4. ✅ **VERIFY:** Navigates back after tapping OK

### G3. Regular Case (No Provider)
1. Navigate to CreateCaseScreen from main menu (not from a provider)
2. ✅ **VERIFY:** Header says "Нова заявка"
3. ✅ **VERIFY:** Subtitle says "Опишете от какво имате нужда"
4. ✅ **VERIFY:** Service type dropdown is empty (not pre-filled)
5. Submit a case
6. ✅ **VERIFY:** Success alert says "Заявката е публикувана. Специалистите ще се свържат с вас скоро."

---

## H. Regression Checks

### H1. CaseBidsScreen — Phone Still Visible After Acceptance
1. As customer, go to a case that has been accepted by an SP
2. ✅ **VERIFY:** SP phone number IS visible on the bids screen
3. ✅ **VERIFY:** "Обади се" button works and dials the number

### H2. CustomerDashboardScreen — VIP Phone Still Visible
1. As customer, check VIP engagement on dashboard
2. ✅ **VERIFY:** VIP SP phone number IS visible
3. ✅ **VERIFY:** Call button works

### H3. SP Profile Edit
1. As SP, go to settings/profile edit
2. ✅ **VERIFY:** Own phone number is still editable and visible in settings

### H4. Chat Still Works for Existing Conversations
1. If customer and SP have an existing chat conversation
2. ✅ **VERIFY:** Existing chat conversations still load and work
3. ✅ **VERIFY:** New messages can be sent/received

### H5. Direct Assignment Flow
1. SP receives a specific case (from "Заявка" button)
2. ✅ **VERIFY:** SP can see the case in their dashboard
3. ✅ **VERIFY:** SP can accept, decline, or counter-offer
4. ✅ **VERIFY:** On accept: points deducted, customer notified
5. ✅ **VERIFY:** On decline: customer gets option to publish to all SPs

---

## I. Edge Cases

### I1. Not Logged In
1. Visit `/map`, `/search`, `/provider/{id}` without logging in
2. ✅ **VERIFY:** No phone numbers visible
3. ✅ **VERIFY:** "Заявка" button either hidden or prompts login on click

### I2. SP Viewing Other SP
1. Log in as SP
2. Visit another SP's profile
3. ✅ **VERIFY:** No phone number visible
4. ✅ **VERIFY:** "Пусни запитване" button behavior (may or may not show — depends on business rules)

### I3. Empty Provider Category
1. From map, tap "Заявка" on provider with no service category set
2. ✅ **VERIFY:** CreateCaseScreen opens with empty service type (no crash)

---

## Pass/Fail Summary

| Section | Area | Status |
|---------|------|--------|
| A | Backend API phone stripping | ⬜ |
| B | Web Map — Заявка + no phone/chat | ⬜ |
| C | Web Search — no chat, keep Заявка | ⬜ |
| D | Web Provider Profile — hidden phone, inquiry CTA | ⬜ |
| E | Mobile MapSearchScreen | ⬜ |
| F | Mobile SearchScreen | ⬜ |
| G | Mobile CreateCaseScreen (provider params) | ⬜ |
| H | Regression (bids, dashboard, chat, direct assignment) | ⬜ |
| I | Edge cases | ⬜ |
