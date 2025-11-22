# Test Plan: Uber-like Features

## 1. Prerequisites
*   **Web Browser** (Chrome/Firefox) for Customer.
*   **Android Device/Emulator** for Provider.
*   **Accounts**: 1 Customer, 1 Provider.
*   **Environment**: Web Server and Backend must be restarted.

## 2. End-to-End Test Flow

### Phase 1: Customer Creation (Web)
1.  Log in as **Customer**.
2.  Navigate to **Create Case**.
3.  **Verify**: Map component is visible in the form.
4.  **Action**: Search for an address (e.g., "Alexander Nevsky Cathedral, Sofia").
5.  **Verify**: Map pin moves to the location. Latitude/Longitude are captured.
6.  **Action**: Select a **Budget** from the dropdown (e.g., "250-500 лв").
7.  **Action**: Submit the case.

### Phase 2: Provider Acceptance (Mobile)
1.  Log in as **Provider**.
2.  Navigate to **Cases Screen**.
3.  **Verify**: The new case appears.
4.  **Verify**: "🗺️ View on Map" button is visible (only for cases with location).
5.  **Action**: Tap "View on Map". Should open Google Maps app.
6.  **Action**: **Accept** the case.

### Phase 3: Start Tracking (Mobile)
1.  Navigate to **My Cases (Assigned)**.
2.  **Verify**: "🚗 Start Travel" button is visible for the accepted case.
3.  **Action**: Tap "Start Travel".
4.  **Verify**: Permission dialog appears (if first time). Grant permission.
5.  **Verify**: Button changes to "⏹️ Stop Sharing".
6.  **Action**: Move device or simulate GPS movement.

### Phase 4: Live Monitoring (Web)
1.  Switch back to **Customer Web**.
2.  Navigate to **My Cases**.
3.  Click **"Details"** on the active case.
4.  **Verify**:
    *   Tracking Map is visible.
    *   **Home Marker** shows customer location.
    *   **Car Marker** shows provider location.
    *   **Financial Panel** shows Budget vs Agreed Price.
5.  **Verify**: As the mobile device moves, the Car Marker updates (approx 5-10s delay).

## 3. Edge Cases to Test
*   **Deny Location Permission**: App should handle it gracefully and not crash.
*   **Network Loss**: Turn off WiFi on mobile. Tracking should resume when reconnected.
*   **Background**: Put mobile app in background. Tracking updates might slow down (depending on OS battery optimization), but should continue if "Always Allow" is granted.

## 4. Troubleshooting
*   **Map Blank?** Check API Key in `.env.local`.
*   **No Coordinates?** Old cases created before this update won't have map features. Create a new case.
*   **Socket Error?** Check browser console for `socket.io` connection errors.
