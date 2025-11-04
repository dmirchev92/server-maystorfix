# Android APK Installation Setup

## Required Android Permissions

To allow users to download and install APK updates, you need to add these permissions to your `AndroidManifest.xml`:

### File: `android/app/src/main/AndroidManifest.xml`

Add these permissions inside the `<manifest>` tag (before `<application>`):

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- Existing permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    
    <!-- ADD THESE FOR APK DOWNLOADS AND INSTALLATION -->
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    
    <application
        ...
    >
        <!-- Your app configuration -->
    </application>
</manifest>
```

## Android 11+ (API 30+) Configuration

For Android 11 and above, you also need to add a `queries` section:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- Permissions here -->
    
    <!-- ADD THIS for Android 11+ -->
    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="http" />
        </intent>
    </queries>
    
    <application
        ...
    >
    </application>
</manifest>
```

## User Instructions for Installing APK

When users download the APK, they need to:

### 1. Enable "Install Unknown Apps"

**Android 8.0+ (Oreo and above):**
1. Go to **Settings** → **Apps & notifications**
2. Tap **Advanced** → **Special app access**
3. Tap **Install unknown apps**
4. Select your browser (Chrome, Firefox, etc.)
5. Enable **Allow from this source**

**Android 7.1 and below:**
1. Go to **Settings** → **Security**
2. Enable **Unknown sources**

### 2. Download and Install

1. Click "Download Update" in the app
2. Browser opens and downloads the APK
3. Once downloaded, tap the notification or go to Downloads folder
4. Tap the APK file
5. Tap **Install**
6. Tap **Open** to launch the updated app

## Testing the Download Flow

### Test on Real Device:

1. Build and install your current APK
2. Change backend version to trigger update
3. Open app → Update modal appears
4. Click "Download Update"
5. Browser should open to: `https://maystorfix.com/downloads/ServiceTextPro-latest.apk`
6. APK should download
7. Install the APK

### Common Issues:

**Issue: "Can't open file"**
- Solution: Enable "Install unknown apps" for your browser

**Issue: "Download failed"**
- Solution: Check internet connection and URL is accessible

**Issue: "App not installed"**
- Solution: Make sure APK is signed with the same keystore

**Issue: "Parse error"**
- Solution: APK file might be corrupted, re-download

## Alternative: Use Google Play Store

For production, consider publishing to Google Play Store:
- No need for "Unknown sources" permission
- Automatic updates
- Better security
- User trust

But for internal testing and beta releases, direct APK download works well!

## Current Setup

Your app is configured to:
- ✅ Check version on startup
- ✅ Show update modal when new version available
- ✅ Open browser to download APK
- ✅ Close modal after clicking download
- ✅ Allow "Later" button to dismiss (if not forced update)

Download URL: `https://maystorfix.com/downloads/ServiceTextPro-latest.apk`
