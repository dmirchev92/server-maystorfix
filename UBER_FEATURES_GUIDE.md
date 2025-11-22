# Uber-like Features Implementation Guide

This guide documents the "Uber-like" features implemented for ServiceText Pro, including Map-based Case Creation, Proximity Search, and Live Provider Tracking.

## 1. Feature Overview

The system now allows:
*   **Customers** to pinpoint their exact location on a map when creating a case.
*   **Service Providers (SPs)** to receive notifications when a case is nearby (Radius Search).
*   **Service Providers** to "Start Travel" and broadcast their live location.
*   **Customers** to watch the Provider's location on a map in real-time.
*   **Budget Transparency**: Both parties see the Customer's Budget and the Agreed Price.

## 2. Architecture

### Backend (`backend/`)
*   **Database**:
    *   `marketplace_service_cases`: Added `latitude`, `longitude`, `formatted_address`, `location_search_status`, `exclusive_until`.
    *   `sp_tracking_sessions`: Stores tracking history.
*   **Jobs** (`src/jobs/LocationSearchJob.ts`):
    *   Runs every 1 minute.
    *   **Radius 5km**: Finds new cases, searches for SPs within 5km, sends notifications.
    *   **Expansion**: After 10 minutes, expands radius to 10km for cases not yet picked up.
*   **Controllers**:
    *   `caseController.ts`: Handles map data in `createCase`. Implements PRO exclusivity (10 mins).
    *   `trackingController.ts`: Receives GPS updates from SPs, updates their profile, and emits Socket.IO events.
*   **Socket.IO**:
    *   New room `case_{caseId}` for real-time tracking updates.
    *   Web client listens to this room.

### Mobile App (`mobile-app/`)
*   **Dependencies**: `react-native-maps`, `react-native-geolocation-service`.
*   **Cases Screen**:
    *   Shows "🗺️ View on Map" button for cases with coordinates.
    *   Shows "🚗 Start Travel" button for Accepted cases.
    *   **Live Tracking**: Captures GPS position every ~5-10 seconds and sends to backend.

### Web Marketplace (`Marketplace/`)
*   **Dependencies**: `@react-google-maps/api`, `use-places-autocomplete`.
*   **Create Case**:
    *   `LocationPicker.tsx`: Google Maps component for address selection.
    *   `UnifiedCaseModal.tsx`: Integrated location picker.
*   **Case Details**:
    *   `TrackingMap.tsx`: Real-time map showing Provider (Car icon) and Customer (Home icon).
    *   Displays "Financial Details": Customer Budget vs Agreed Price.

## 3. Setup & Configuration

### Google Maps API Key
You must add your Google Maps API Key to:
1.  **Web**: `Marketplace/.env.local` -> `NEXT_PUBLIC_GOOGLE_MAPS_KEY`
2.  **Mobile**: `mobile-app/android/app/src/main/AndroidManifest.xml` (Meta-data tag)

### Build Instructions
1.  **Backend**: Restart server to load new jobs.
    ```bash
    pm2 restart all
    ```
2.  **Mobile**: Rebuild is **REQUIRED** for native map/geolocation libraries.
    ```bash
    cd mobile-app
    npm install
    npm run android
    ```
3.  **Web**: Restart dev server or rebuild.
    ```bash
    cd Marketplace
    npm run dev
    ```

## 4. Usage Flow

1.  **Customer (Web)**:
    *   Click "Create Case".
    *   Select "Service Type".
    *   Use the Map to pinpoint location.
    *   Submit.
2.  **Backend**:
    *   Case saved with coordinates.
    *   `LocationSearchJob` finds SPs in 5km.
    *   Notifications sent.
3.  **Provider (Mobile)**:
    *   Receives notification.
    *   Opens App -> Cases.
    *   Sees case with "View on Map".
    *   Accepts Case.
    *   Clicks "🚗 Start Travel".
4.  **Customer (Web)**:
    *   Goes to "My Cases" -> "Details".
    *   Sees the Map with the Provider's moving car icon.
    *   Sees the Agreed Price (from the winning bid or direct assignment).

## 5. Database Schema Changes

```sql
ALTER TABLE marketplace_service_cases 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8),
ADD COLUMN formatted_address TEXT,
ADD COLUMN location_search_status VARCHAR(20) DEFAULT 'pending', -- pending, active, active_waiting, expanded, completed
ADD COLUMN search_radius_km INTEGER DEFAULT 0,
ADD COLUMN location_search_started_at TIMESTAMP,
ADD COLUMN exclusive_until TIMESTAMP;

CREATE TABLE sp_tracking_sessions (
    id SERIAL PRIMARY KEY,
    provider_id UUID NOT NULL,
    case_id UUID,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    heading DECIMAL(5, 2),
    speed DECIMAL(5, 2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 6. Troubleshooting

*   **Map not loading**: Check API Key and enabled APIs (Maps JS, Places, Geocoding) in Google Cloud Console.
*   **Tracking not updating**: Check if Mobile App has Location Permissions (Always Allow or While Using). Check if Backend Socket.IO is connected.
*   **Notifications not received**: Check `service_provider_profiles` for valid `latitude/longitude`. The job only notifies SPs with known locations.
