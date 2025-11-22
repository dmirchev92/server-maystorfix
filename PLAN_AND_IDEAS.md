# Location Implementation & Feature Plan

## 1. The "How" - Location Technology & Costs

You specifically asked for **Google Maps** integration. This is the "Uber" standard but comes with costs. Here is the breakdown:

### **Google Maps Platform (Required Services)**
To achieve the "Pin address on map" and "Autocomplete" functionality, we need:

1.  **Maps JavaScript API (Web)** / **Maps SDK (Android/iOS)**:
    *   *What it does*: Displays the interactive map.
    *   *Cost*:
        *   **Mobile (Android/iOS SDK)**: **FREE** (Unlimited display).
        *   **Web (JS API)**: **FREE** up to 28,500 loads/month. After that ~$7.00 per 1,000 loads.
2.  **Places API (Autocomplete)**:
    *   *What it does*: The search bar where user types "Mladost 1..." and gets suggestions.
    *   *Cost*: ~$2.83 per 1,000 requests.
    *   *Optimization*: We will use **Session Tokens**. This means if a user types 10 characters ("S", "o", "f"...), it counts as **1 request**, not 10.
3.  **Geocoding API**:
    *   *What it does*: Converts the selected address string into GPS coordinates (Latitude/Longitude).
    *   *Cost*: ~$5.00 per 1,000 requests.

### **Estimated Monthly Cost**
For a growing startup (e.g., 1,000 cases/month):
*   **Mobile Maps**: $0
*   **Places/Geocoding**: ~$10 - $20
*   **Google Free Tier**: Google gives everyone **$200 free credit every month**.
*   **Verdict**: **You will likely pay $0** for a long time until you scale significantly.

### **Alternative (Free - OpenStreetMap)**
*   We can use **Leaflet (Web)** and **Mapbox (Mobile)**.
*   *Pros*: Free.
*   *Cons*: Less accurate in Bulgaria (sometimes), search/autocomplete is worse than Google, "Look & Feel" is not as premium/Uber-like.
*   **Recommendation**: **Stick with Google Maps**. The $200 credit covers a lot, and the UX is superior.

---

## 2. Detailed Tooling Plan

### **Mobile App (React Native)**
We need to install these *new* libraries:
1.  `react-native-maps`: The standard for displaying Google Maps on iOS/Android.
2.  `react-native-google-places-autocomplete`: For the "Uber-style" search bar overlay.
3.  `react-native-geocoding`: Easier interface for the Geocoding API.
4.  `react-native-permissions`: To handle "Allow Location?" popups correctly on iOS/Android.

### **Web (Next.js / React)**
1.  `@react-google-maps/api`: The best library for React Google Maps.
2.  `use-places-autocomplete`: Lightweight hook for the search bar logic.

### **Backend (Node/Postgres)**
*   **No new heavy libraries needed.**
*   We will use **PostgreSQL** with standard math functions for the radius search (Haversine formula).
*   This keeps the backend fast and dependency-free.

---

## 3. "Uber-like" Feature Ideas

Here are 5 advanced features to make this stand out:

### 🚀 1. "Instant Book" (Skip the Bidding)
*   **Idea**: Allow customers to set a fixed price (e.g., "Standard Visit - 50 BGN").
*   **Mechanism**: The notification goes to PROs. The *first* one to click "Accept" gets the job instantly. No bidding, no waiting.
*   **Why**: Speed. Uber doesn't make you bid for a driver; you just get one.

### 📍 2. "Live Provider Tracking" (Phase 2)
*   **Idea**: When the SP accepts and clicks "I'm on my way", the customer sees their car icon moving on the map.
*   **Mechanism**: Requires the SP app to send GPS updates every 10s.
*   **Why**: Trust. "He is actually coming."

### 📸 3. "Visual Check-In / Check-Out"
*   **Idea**: The SP *cannot* mark the job as "Started" or "Completed" unless they are physically at the GPS location (verified by app) AND take a photo of the work.
*   **Why**: Dispute resolution. Proof they were there.

### 🔔 4. "Neighborhood Watch" Alerts
*   **Idea**: If a user posts a "Leak" job in "Mladost 4", notify other *Customers* in Mladost 4: *"Plumber nearby! Do you need a check-up?"*
*   **Mechanism**: SP can offer a discount for a second job in the same building.
*   **Why**: Efficiency for SPs (2 jobs, 1 trip), savings for Customers.

### 🛡️ 5. "Emergency Panic Mode" (Premium Service)
*   **Idea**: A red "EMERGENCY" button for bursting pipes/electrical fires.
*   **Mechanism**: Bypasses the 10-min delay. Notifies ALL providers within 3km immediately with a loud alarm sound.
*   **Price**: Costs +20% extra for the customer.

---

## 4. Next Steps

**Are you happy with the Google Maps plan (using the $200 free credit)?**

If yes, I will:
1.  Execute the Database Migration (add location columns).
2.  Install the Google Maps libraries in the Mobile App.
3.  Create the "Location Selection" screen.
