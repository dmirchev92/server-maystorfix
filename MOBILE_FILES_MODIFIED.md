# Modified Mobile App Files for APK Build

## Date: November 3, 2025

### Files to Copy to Your Local Machine

Copy these files from the server to your local mobile-app directory:

---

## 1. Service Categories Feature

### New Files Created:
```
mobile-app/src/constants/serviceCategories.ts
mobile-app/src/screens/ServiceCategoriesScreen.tsx
```

### Modified Files:
```
mobile-app/src/screens/SettingsScreen.tsx
```

**Changes in SettingsScreen.tsx:**
- Added navigation item "🔧 Специализации" in Profile section (line ~270)

---

## 2. Chat Keyboard Fixes (UPDATED - Nov 3, 2025)

### Modified Files:
```
mobile-app/src/screens/ChatDetailScreen.tsx
```

**Changes in ChatDetailScreen.tsx:**

### ✅ **Fix 1: KeyboardAvoidingView Behavior (Line 366)**
- **Before:** `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`
- **After:** `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`
- **Why:** Android needs explicit behavior to avoid keyboard, `undefined` doesn't work

### ✅ **Fix 2: Keyboard Vertical Offset (Line 367)**
- **Before:** `keyboardVerticalOffset={0}`
- **After:** `keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}`
- **Why:** iOS needs offset for header height, Android doesn't

### ✅ **Fix 3: Input Container Positioning (Line 594-602)**
- **Before:** `position: 'absolute', bottom: 65, zIndex: 999`
- **After:** Normal flex layout with `marginBottom: 65`
- **Why:** Absolute positioning keeps input fixed, goes under keyboard. Flex layout moves with keyboard.

### ✅ **Fix 4: Enter Key Handler (Line 401-403)**
- **Added:** `onSubmitEditing={handleSendMessage}`
- **Added:** `returnKeyType="send"`
- **Added:** `blurOnSubmit={false}`
- **Why:** Allows sending message by pressing Enter/Send on keyboard

### ✅ **Fix 5: FlatList Padding (Line 502-505)**
- **Before:** Inline `paddingBottom: 150`
- **After:** `paddingBottom: 20` in styles
- **Why:** Excessive padding wasted space, KeyboardAvoidingView handles spacing

### ✅ **Fix 6: Create Case Button Position (Line 634)**
- **Before:** `bottom: 150`
- **After:** `bottom: 160`
- **Why:** Adjusted for new input layout

### 🎯 **Expected Behavior:**
1. ✅ Tap input field → Keyboard appears
2. ✅ Input field moves UP with keyboard (stays visible)
3. ✅ Input field always above keyboard (like Facebook Messenger)
4. ✅ Press Enter on keyboard → Message sends
5. ✅ Keyboard stays open after sending
6. ✅ Input never goes under tab bar (65px)

---

## 3. Push Notification Name Fix (Backend - Already Deployed)

**Backend files modified (already live on server):**
```
backend/src/controllers/chatControllerV2.ts
```

**Changes:**
- Fixed sender name in push notifications to use business name for service providers
- Added proper null checks for firstName/lastName
- Query database for business_name when sender is a service provider
- Fallback chain: business_name → firstName lastName → "Unknown User"

**Specific changes in chatControllerV2.ts (lines 142-173):**
- Added `userFirstName` and `userLastName` with null coalescing
- Query `service_provider_profiles` table for business name
- Construct userName with proper fallbacks
- Push notification now shows: "New message from [Business Name]" or "New message from [First Last]"

---

## Complete File List to Download:

### Priority 1 - Required for Service Categories:
1. `mobile-app/src/constants/serviceCategories.ts` ✅ NEW
2. `mobile-app/src/screens/ServiceCategoriesScreen.tsx` ✅ NEW
3. `mobile-app/src/screens/SettingsScreen.tsx` ✅ MODIFIED

### Priority 2 - Required for Chat Fixes:
4. `mobile-app/src/screens/ChatDetailScreen.tsx` ✅ MODIFIED

### Priority 3 - App Version Check (NEW):
5. `mobile-app/src/components/AppVersionCheck.tsx` ✅ NEW
6. `mobile-app/App.tsx` ✅ MODIFIED

---

## How to Copy Files from Server:

### Option 1: Using SCP (from your local machine)
```bash
# Create a temporary directory
mkdir ~/temp-mobile-updates

# Copy the new constants file
scp root@your-server:/var/www/servicetextpro/mobile-app/src/constants/serviceCategories.ts ~/temp-mobile-updates/

# Copy the new screen
scp root@your-server:/var/www/servicetextpro/mobile-app/src/screens/ServiceCategoriesScreen.tsx ~/temp-mobile-updates/

# Copy modified screens
scp root@your-server:/var/www/servicetextpro/mobile-app/src/screens/SettingsScreen.tsx ~/temp-mobile-updates/
scp root@your-server:/var/www/servicetextpro/mobile-app/src/screens/ChatDetailScreen.tsx ~/temp-mobile-updates/
```

### Option 2: Direct Copy Commands (run on server)
```bash
# Navigate to mobile app directory
cd /var/www/servicetextpro/mobile-app

# Show the modified files
ls -la src/constants/serviceCategories.ts
ls -la src/screens/ServiceCategoriesScreen.tsx
ls -la src/screens/SettingsScreen.tsx
ls -la src/screens/ChatDetailScreen.tsx
```

---

## After Copying Files to Local Machine:

1. **Place files in correct locations:**
   ```
   your-local-project/
   ├── mobile-app/
   │   └── src/
   │       ├── constants/
   │       │   └── serviceCategories.ts          ← NEW
   │       └── screens/
   │           ├── ServiceCategoriesScreen.tsx   ← NEW
   │           ├── SettingsScreen.tsx            ← REPLACE
   │           └── ChatDetailScreen.tsx          ← REPLACE
   ```

2. **Build APK:**
   ```bash
   cd mobile-app
   
   # For Android
   npx react-native run-android --variant=release
   
   # Or build APK
   cd android
   ./gradlew assembleRelease
   
   # APK will be at:
   # android/app/build/outputs/apk/release/app-release.apk
   ```

3. **Test the new features:**
   - ✅ Go to Settings → "🔧 Специализации"
   - ✅ Select/deselect service categories
   - ✅ Pull to refresh to sync with web
   - ✅ Test chat keyboard (should not hide input)
   - ✅ Press Enter in chat to send message
   - ✅ Check push notifications show correct names

---

## API Endpoints Used (Already Live):

- `GET /api/v1/provider/categories` - Get provider's categories
- `POST /api/v1/provider/categories` - Add a category
- `PUT /api/v1/provider/categories` - Update all categories
- `DELETE /api/v1/provider/categories/:id` - Remove a category

---

## Database Changes (Already Applied):

- ✅ Created `provider_service_categories` table
- ✅ Migrated existing data (21 providers)
- ✅ Tier limits enforced (FREE: 2, NORMAL: 5, PRO: unlimited)

---

## Sync Between Web and Mobile:

Both platforms now share:
- ✅ Same API endpoints
- ✅ Same database table
- ✅ Same service categories list
- ✅ Real-time sync (changes on web appear on mobile and vice versa)

---

## Testing Checklist:

### Service Categories:
- [ ] Open app → Settings → Специализации
- [ ] Select 2 categories (FREE tier limit)
- [ ] Try to select 3rd category (should show limit message)
- [ ] Pull down to refresh
- [ ] Go to web settings, change categories
- [ ] Return to app, pull to refresh (should sync)

### Chat Fixes:
- [ ] Open any chat conversation
- [ ] Type a message
- [ ] Keyboard should NOT hide the input field
- [ ] Press Enter/Send on keyboard
- [ ] Message should send immediately
- [ ] Input should stay focused after sending

### Push Notifications:
- [ ] Have someone send you a message
- [ ] Check notification shows proper name (not "undefined")
- [ ] For service providers, should show business name

---

## Build Notes:

- **Android Min SDK:** 21
- **Target SDK:** 33
- **React Native Version:** Check package.json
- **Required Permissions:** Already configured in AndroidManifest.xml

---

## Rollback Instructions (if needed):

If you need to rollback these changes:
```bash
# On server
cd /var/www/servicetextpro
git log --oneline -5
git revert <commit-hash>
pm2 restart all
```

---

## Support:

All backend changes are already deployed and tested on:
- **Web:** https://maystorfix.com/settings
- **API:** https://maystorfix.com/api/v1/provider/categories

If you encounter any issues building the APK, check:
1. Node modules are installed (`npm install`)
2. Android SDK is properly configured
3. Gradle build tools are up to date
