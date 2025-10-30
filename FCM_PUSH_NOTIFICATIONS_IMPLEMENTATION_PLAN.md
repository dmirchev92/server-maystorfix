# 🚀 FCM Push Notifications - Comprehensive Implementation Plan

**Date:** October 29, 2025  
**Objective:** Enable push notifications when app is closed, background, or phone is locked

---

## 📊 **Current State Analysis**

### **What Works:**
✅ Socket.IO real-time messaging (app must be open)  
✅ Local notifications via `@notifee/react-native`  
✅ Notification channels configured  
✅ Permission handling  
✅ Backend notification events (message:new, case_assigned)  

### **What Doesn't Work:**
❌ Notifications when app is closed  
❌ Notifications when app is in background  
❌ Notifications when phone is locked  
❌ Device token management  
❌ FCM integration  

---

## 🏗️ **Architecture Design**

### **Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────────┐
│                      NOTIFICATION FLOW                           │
└─────────────────────────────────────────────────────────────────┘

1. EVENT OCCURS (New Message / Case Assignment)
   ↓
2. Backend NotificationService.createNotification()
   ↓
3. DUAL EMISSION:
   ├─→ Socket.IO (for open apps) → message:new event
   └─→ FCM Service → Send push to device token
       ↓
4. FCM Server (Google)
   ↓
5. Device receives push (even if app closed)
   ↓
6. @notifee displays notification with sound/vibration
   ↓
7. User taps → App opens to relevant screen
```

---

## 🗄️ **Database Schema Changes**

### **New Table: `device_tokens`**

```sql
CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  device_info JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_token ON device_tokens(token);
CREATE INDEX idx_device_tokens_active ON device_tokens(user_id, is_active);
```

**Purpose:**
- Store FCM device tokens for each user
- Support multiple devices per user
- Track active/inactive tokens
- Store device metadata for debugging

---

## 📦 **Backend Implementation**

### **1. Install Dependencies**

```bash
cd /var/www/servicetextpro/backend
npm install firebase-admin
```

### **2. New Files to Create**

#### **`src/services/FCMService.ts`**
- Initialize Firebase Admin SDK
- Send push notifications to device tokens
- Handle token validation
- Batch sending for multiple devices
- Error handling and retry logic

#### **`src/controllers/deviceTokenController.ts`**
- Register device token endpoint
- Update device token endpoint
- Delete device token endpoint
- Get user's devices endpoint

#### **`src/routes/deviceToken.ts`**
- POST `/api/v1/device-tokens/register`
- PUT `/api/v1/device-tokens/:tokenId`
- DELETE `/api/v1/device-tokens/:tokenId`
- GET `/api/v1/device-tokens`

### **3. Modify Existing Files**

#### **`src/services/NotificationService.ts`**
Add FCM push after Socket.IO emission:

```typescript
// After Socket.IO emission
if (this.io) {
  this.io.of('/chat').to(`user:${userId}`).emit('message:new', data);
}

// NEW: Send FCM push notification
await this.fcmService.sendNotificationToUser(userId, {
  title,
  body: message,
  data: {
    type,
    ...data
  }
});
```

#### **`src/models/PostgreSQLDatabase.ts`**
Add device_tokens table to `initializeTables()` method

#### **`src/server.ts`**
- Import and register device token routes
- Initialize FCM service

---

## 📱 **Mobile App Implementation**

### **1. Install Dependencies**

```bash
cd /var/www/servicetextpro/mobile-app
npm install @react-native-firebase/app @react-native-firebase/messaging
```

### **2. Android Configuration**

#### **`android/build.gradle`**
Add Google services classpath:

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

#### **`android/app/build.gradle`**
Apply Google services plugin:

```gradle
apply plugin: 'com.google.gms.google-services'
```

#### **`android/app/google-services.json`**
Download from Firebase Console and place here

#### **`android/app/src/main/AndroidManifest.xml`**
Add Firebase messaging service:

```xml
<service
    android:name="com.servicetextpro.FCMService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

### **3. New Files to Create**

#### **`src/services/FCMService.ts`**
```typescript
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import ApiService from './ApiService';

class FCMService {
  // Request FCM permission
  async requestPermission(): Promise<boolean>
  
  // Get FCM token
  async getToken(): Promise<string | null>
  
  // Register token with backend
  async registerToken(token: string): Promise<void>
  
  // Handle foreground messages
  setupForegroundHandler(): void
  
  // Handle background messages
  setupBackgroundHandler(): void
  
  // Handle notification tap
  setupNotificationOpenedHandler(): void
}
```

#### **`android/app/src/main/java/com/servicetextpro/FCMService.java`**
Native Android service for background message handling

### **4. Modify Existing Files**

#### **`App.tsx`**
Initialize FCM on app start:

```typescript
useEffect(() => {
  const initializeFCM = async () => {
    const fcmService = FCMService.getInstance();
    await fcmService.initialize();
    
    // Get token and register
    const token = await fcmService.getToken();
    if (token) {
      await fcmService.registerToken(token);
    }
  };
  
  initializeFCM();
}, []);
```

#### **`src/services/NotificationService.ts`**
Keep existing local notification logic (used by both Socket.IO and FCM)

---

## 🔐 **Firebase Setup Requirements**

### **Prerequisites:**
1. Firebase project created
2. Android app registered in Firebase Console
3. `google-services.json` downloaded
4. Firebase Admin SDK service account key downloaded

### **Firebase Console Steps:**
1. Go to https://console.firebase.google.com
2. Create new project or use existing
3. Add Android app:
   - Package name: `com.servicetextpro` (from AndroidManifest.xml)
   - Download `google-services.json`
4. Project Settings → Service Accounts
   - Generate new private key
   - Save as `firebase-admin-key.json`
5. Cloud Messaging → Enable

---

## 🔧 **Environment Variables**

### **Backend `.env`**
```env
# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

---

## 📝 **Implementation Steps**

### **Phase 1: Backend Setup (30 min)**
1. ✅ Create device_tokens table
2. ✅ Install firebase-admin
3. ✅ Create FCMService
4. ✅ Create deviceTokenController
5. ✅ Add routes
6. ✅ Modify NotificationService
7. ✅ Test with Postman

### **Phase 2: Mobile App Setup (45 min)**
1. ✅ Install Firebase packages
2. ✅ Configure Android (google-services.json)
3. ✅ Create FCMService
4. ✅ Modify App.tsx
5. ✅ Create background handler
6. ✅ Test foreground notifications
7. ✅ Test background notifications
8. ✅ Test killed app notifications

### **Phase 3: Integration Testing (15 min)**
1. ✅ Send test message from web
2. ✅ Verify Socket.IO (app open)
3. ✅ Verify FCM (app background)
4. ✅ Verify FCM (app killed)
5. ✅ Verify notification tap navigation
6. ✅ Test multiple devices

---

## 🎯 **Expected Behavior After Implementation**

### **Scenario 1: App Open**
```
Message sent → Socket.IO receives → Local notification displays
```

### **Scenario 2: App Background**
```
Message sent → FCM push → Device wakes → Notification displays
```

### **Scenario 3: App Killed**
```
Message sent → FCM push → Device wakes → Notification displays
```

### **Scenario 4: Phone Locked**
```
Message sent → FCM push → Lock screen notification → Sound/vibration
```

---

## 🧪 **Testing Checklist**

### **Backend Tests:**
- [ ] Device token registration works
- [ ] Token stored in database
- [ ] FCM service sends successfully
- [ ] Multiple devices per user supported
- [ ] Invalid tokens handled gracefully

### **Mobile App Tests:**
- [ ] FCM permission requested
- [ ] Token generated successfully
- [ ] Token registered with backend
- [ ] Foreground notifications display
- [ ] Background notifications display
- [ ] Killed app notifications display
- [ ] Lock screen notifications display
- [ ] Notification tap opens correct screen
- [ ] Sound plays correctly
- [ ] Vibration works
- [ ] Multiple notifications grouped

---

## 📊 **Database Queries for Monitoring**

### **Check registered devices:**
```sql
SELECT u.email, dt.platform, dt.token, dt.last_used_at, dt.is_active
FROM device_tokens dt
JOIN users u ON dt.user_id = u.id
ORDER BY dt.last_used_at DESC;
```

### **Count devices per user:**
```sql
SELECT u.email, COUNT(dt.id) as device_count
FROM users u
LEFT JOIN device_tokens dt ON u.id = dt.user_id AND dt.is_active = true
GROUP BY u.id, u.email
ORDER BY device_count DESC;
```

### **Find inactive tokens:**
```sql
SELECT * FROM device_tokens
WHERE last_used_at < NOW() - INTERVAL '30 days'
AND is_active = true;
```

---

## 🚨 **Potential Issues & Solutions**

### **Issue 1: Token Registration Fails**
**Cause:** Firebase not initialized  
**Solution:** Check google-services.json placement and Firebase initialization

### **Issue 2: No Background Notifications**
**Cause:** Background handler not registered  
**Solution:** Ensure `messaging().setBackgroundMessageHandler()` is called

### **Issue 3: Notifications Not Showing**
**Cause:** Channel not created or permission denied  
**Solution:** Verify channel creation and permission status

### **Issue 4: Multiple Notifications for Same Message**
**Cause:** Both Socket.IO and FCM triggering  
**Solution:** Add deduplication logic based on message ID

### **Issue 5: Token Expired**
**Cause:** FCM token refresh not handled  
**Solution:** Listen to `onTokenRefresh` and update backend

---

## 📈 **Performance Considerations**

### **Backend:**
- Batch FCM sends (up to 500 devices per request)
- Use async/await for non-blocking
- Cache active tokens in Redis (optional)
- Implement retry logic with exponential backoff

### **Mobile App:**
- Debounce token registration
- Handle token refresh automatically
- Clean up old tokens on logout
- Limit notification display rate

---

## 🔒 **Security Considerations**

1. **Token Security:**
   - Never expose Firebase Admin SDK key
   - Store in environment variables
   - Use .gitignore for sensitive files

2. **User Privacy:**
   - Delete tokens on logout
   - Mark tokens inactive instead of deleting
   - GDPR compliance: delete on user deletion

3. **Rate Limiting:**
   - Limit token registration attempts
   - Prevent spam notifications
   - Implement cooldown periods

---

## 📚 **Documentation Links**

- Firebase Admin SDK: https://firebase.google.com/docs/admin/setup
- React Native Firebase: https://rnfirebase.io/
- FCM HTTP v1 API: https://firebase.google.com/docs/cloud-messaging/http-server-ref
- Notifee Documentation: https://notifee.app/react-native/docs/overview

---

## ✅ **Success Criteria**

After implementation, the following must work:

1. ✅ User receives notifications when app is closed
2. ✅ User receives notifications when app is in background
3. ✅ User receives notifications when phone is locked
4. ✅ Notifications play sound
5. ✅ Notifications vibrate
6. ✅ Notifications show on lock screen
7. ✅ Tapping notification opens correct screen
8. ✅ Multiple devices per user supported
9. ✅ Token refresh handled automatically
10. ✅ No duplicate notifications

---

## 🎯 **Next Steps**

Ready to proceed with implementation?

**Estimated Time:** 90 minutes total
- Backend: 30 minutes
- Mobile App: 45 minutes
- Testing: 15 minutes

**Requirements:**
1. Firebase project access (or create new)
2. Ability to download google-services.json
3. Firebase Admin SDK key
4. Test Android device or emulator

**Proceed?** Type "yes" to start implementation! 🚀
