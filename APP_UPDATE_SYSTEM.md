# App Update System - Complete Guide

## Overview

The app now has an automatic update check system that prompts users to download new versions when available.

---

## How It Works

### 1. **Version Check on App Startup**
- App checks version on every launch
- Compares current version (from package.json) with server version
- Shows update modal if new version available

### 2. **Backend API**
- Endpoint: `GET https://maystorfix.com/api/v1/app/version`
- Returns latest version info, download URL, and release notes

### 3. **Update Modal**
- Shows version number, release notes, and features
- "Download Update" button opens APK download link
- "Later" button (only if update is optional)
- Can be set to "force update" for critical versions

---

## How to Release a New Version

### Step 1: Update Version in Backend

Edit `/var/www/servicetextpro/backend/src/controllers/appVersionController.ts`:

```typescript
const versionInfo = {
  latestVersion: '1.0.1', // ← UPDATE THIS
  minimumVersion: '1.0.0', // Minimum version that still works
  downloadUrl: 'https://maystorfix.com/downloads/app-latest.apk',
  updateRequired: false, // Set to true to force update
  releaseNotes: {
    bg: 'Нова версия с подобрения и поправки', // ← UPDATE THIS
    en: 'New version with improvements and fixes'
  },
  features: [ // ← UPDATE THIS
    'Управление на специализации',
    'Подобрения в чата',
    'Поправка на push известията'
  ]
};
```

### Step 2: Build and Restart Backend

```bash
cd /var/www/servicetextpro/backend
npm run build
pm2 restart servicetextpro-backend
```

### Step 3: Update Version in Mobile App

Edit `/var/www/servicetextpro/mobile-app/package.json`:

```json
{
  "name": "ServiceTextPro",
  "version": "1.0.1", // ← UPDATE THIS to match backend
  ...
}
```

### Step 4: Build New APK

On your local machine:

```bash
cd mobile-app
cd android
./gradlew clean
./gradlew assembleRelease

# APK will be at:
# android/app/build/outputs/apk/release/app-release.apk
```

### Step 5: Upload APK to Server

Upload the APK to your downloads folder:

```bash
# From your local machine
scp android/app/build/outputs/apk/release/app-release.apk root@46.224.11.139:/var/www/servicetextpro/Marketplace/public/downloads/app-latest.apk
```

Or rename it on the server:

```bash
# On the server
cd /var/www/servicetextpro/Marketplace/public/downloads
mv app-release.apk app-latest.apk
```

---

## Download URL

The APK should be accessible at:
```
https://maystorfix.com/downloads/app-latest.apk
```

Make sure the file has proper permissions:
```bash
chmod 644 /var/www/servicetextpro/Marketplace/public/downloads/app-latest.apk
```

---

## Version Comparison Logic

The app compares versions using semantic versioning:

- `1.0.0` < `1.0.1` → Update available
- `1.0.1` < `1.1.0` → Update available
- `1.1.0` < `2.0.0` → Update available

---

## Force Update vs Optional Update

### Optional Update (default):
```typescript
updateRequired: false
```
- User can click "Later" to skip
- Modal shows again on next app launch

### Force Update:
```typescript
updateRequired: true
```
- No "Later" button
- User MUST update to continue using app
- Use for critical security updates or breaking changes

---

## Testing the Update System

### Test on Development:

1. **Set current version to 1.0.0** in mobile app's `package.json`
2. **Set backend version to 1.0.1**
3. **Build and run the app**
4. **You should see the update modal immediately**

### Test Download:

1. Click "Download Update" button
2. Should open browser to download APK
3. Install the APK (may need to enable "Install from Unknown Sources")

---

## Customizing the Update Modal

Edit `/var/www/servicetextpro/mobile-app/src/components/AppVersionCheck.tsx`:

### Change Colors:
```typescript
borderColor: '#6366F1', // Purple border
backgroundColor: '#1E293B', // Dark background
```

### Change Text:
```typescript
headerTitle: 'Налична е нова версия' // Update available
updateButtonText: '📥 Изтегли обновление' // Download update
```

### Change Icon:
```typescript
headerIcon: '🚀' // Rocket icon
```

---

## API Response Format

```json
{
  "success": true,
  "data": {
    "latestVersion": "1.0.1",
    "minimumVersion": "1.0.0",
    "downloadUrl": "https://maystorfix.com/downloads/app-latest.apk",
    "updateRequired": false,
    "releaseNotes": {
      "bg": "Нова версия с подобрения",
      "en": "New version with improvements"
    },
    "features": [
      "Feature 1",
      "Feature 2",
      "Feature 3"
    ]
  }
}
```

---

## Troubleshooting

### Update Modal Not Showing:
1. Check backend API is running: `https://maystorfix.com/api/v1/app/version`
2. Check app version in package.json
3. Check console logs in app

### Download Not Working:
1. Verify APK exists at download URL
2. Check file permissions (should be 644)
3. Test URL in browser: `https://maystorfix.com/downloads/app-latest.apk`

### APK Won't Install:
1. Enable "Install from Unknown Sources" in Android settings
2. Make sure APK is signed properly
3. Check APK is not corrupted

---

## Security Notes

1. **Always sign your APK** with the same keystore for updates
2. **Use HTTPS** for download URL (already configured)
3. **Test updates** on a test device before releasing to all users
4. **Keep old versions** available for rollback if needed

---

## Quick Reference

| Action | Command |
|--------|---------|
| Check API | `curl https://maystorfix.com/api/v1/app/version` |
| Upload APK | `scp app-release.apk root@46.224.11.139:/var/www/servicetextpro/Marketplace/public/downloads/app-latest.apk` |
| Restart Backend | `pm2 restart servicetextpro-backend` |
| Build APK | `cd android && ./gradlew assembleRelease` |

---

## Example Release Workflow

1. ✅ Make code changes
2. ✅ Update version in `mobile-app/package.json` to `1.0.1`
3. ✅ Update version in backend controller to `1.0.1`
4. ✅ Add release notes and features in backend
5. ✅ Build backend: `npm run build && pm2 restart`
6. ✅ Build APK locally
7. ✅ Upload APK to server as `app-latest.apk`
8. ✅ Test by launching app with old version
9. ✅ Verify update modal appears
10. ✅ Verify download and install works

---

## Files Modified

### Backend:
- `backend/src/controllers/appVersionController.ts` ✅ NEW
- `backend/src/server.ts` ✅ MODIFIED (added route)

### Mobile App:
- `mobile-app/src/components/AppVersionCheck.tsx` ✅ NEW
- `mobile-app/App.tsx` ✅ MODIFIED (added component)

---

## Current Configuration

- **API Endpoint:** `https://maystorfix.com/api/v1/app/version`
- **Download URL:** `https://maystorfix.com/downloads/app-latest.apk`
- **Current Version:** Check `mobile-app/package.json`
- **Backend Version:** Check backend controller

---

## Future Enhancements

Possible improvements:
- Store version info in database instead of code
- Admin panel to manage versions
- Track update adoption rates
- A/B testing for updates
- Automatic APK upload via CI/CD
