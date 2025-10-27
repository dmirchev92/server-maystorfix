# Chat Token System - Current Status & Fix Plan

## Date: October 27, 2025, 10:06 PM

## 📊 CURRENT STATUS

### ✅ What's Working (Backend)
The backend has a complete chat token system with these endpoints:

1. **POST /api/v1/chat/tokens/initialize** - Initialize token for authenticated user
2. **POST /api/v1/chat/tokens/initialize-device** - Initialize token for device users
3. **GET /api/v1/chat/tokens/current** - Get current unused token
4. **POST /api/v1/chat/tokens/regenerate** - Generate new token
5. **POST /api/v1/chat/tokens/regenerate-device** - Generate new token for devices
6. **GET /api/v1/chat/tokens/stats** - Get token statistics
7. **POST /api/v1/chat/tokens/cleanup** - Clean up expired tokens

### ✅ What's Working (Mobile App - SMS Service)
The mobile app's `SMSService.ts` already uses the chat token system:
- `getCurrentTokenFromBackend()` - Gets current token
- `regenerateChatLinkViaBackend()` - Regenerates token
- `initializeChatTokenSystem()` - Initializes token system

### ❌ What's NOT Working
1. **Chat API endpoint mismatch** - App is calling wrong endpoint for conversations
2. **Socket.IO not connecting** - No logs showing socket connection
3. **Chat messages not loading** - API returns 404

---

## 🔧 FIX PLAN

### Fix 1: Update Chat API Endpoint

**Current (WRONG):**
```typescript
GET /v1/chat/user/{userId}/conversations
```

**Should be:**
```typescript
GET /v1/chat/conversations
```

The Chat API V2 automatically gets conversations for the authenticated user from the auth token.

**File to fix:** `/var/www/servicetextpro/mobile-app/src/services/ApiService.ts`

---

### Fix 2: Ensure Socket.IO Connects

The socket should connect to `/chat` namespace with auth token.

**Expected logs (not seeing these):**
```
🔌 Connecting to Socket.IO /chat namespace...
✅ Socket.IO connected: [socketId]
✅ NotificationService initialized
```

**File to check:** `/var/www/servicetextpro/mobile-app/src/services/SocketIOService.ts`

---

### Fix 3: Chat Token Integration

The chat token system is for **public chat links** (SMS invitations), NOT for authenticated chat.

**Two separate systems:**

1. **Authenticated Chat** (what we're fixing now)
   - Uses auth token from login
   - Connects to Socket.IO `/chat` namespace
   - Calls `/api/v1/chat/conversations`
   - For provider-to-customer communication

2. **Public Chat Links** (already working)
   - Uses chat tokens from SMS
   - URL: `/u/{spIdentifier}/c/{token}`
   - For customers to initiate chat without login
   - Already implemented in SMSService.ts

---

## 🎯 IMMEDIATE FIXES NEEDED

### 1. Fix ApiService.ts - Conversations Endpoint

**Location:** Line ~217-221

**Change from:**
```typescript
public async getConversations(): Promise<APIResponse> {
  console.log('📱 ApiService - Getting conversations via Chat API V2');
  // Get user ID first
  const userResponse = await this.getCurrentUser();
  const userId = userResponse.data?.user?.id || userResponse.data?.id;
  
  return this.makeRequest(`/chat/user/${userId}/conversations`);
}
```

**Change to:**
```typescript
public async getConversations(): Promise<APIResponse> {
  console.log('📱 ApiService - Getting conversations via Chat API V2');
  // Chat API V2 automatically gets conversations for authenticated user
  // No need to pass userId - it's extracted from auth token
  return this.makeRequest('/chat/conversations');
}
```

---

### 2. Fix ChatScreen.tsx - Remove userId Logic

**Location:** Line ~60-95

**Remove this section:**
```typescript
// Get current user
console.log('📱 ChatScreen - Getting current user');
const userResponse = await ApiService.getInstance().getCurrentUser();
console.log('📱 ChatScreen - User response:', userResponse);

const userData: any = userResponse.data?.user || userResponse.data;
console.log('📱 ChatScreen - User data:', userData);

if (!userData || !userData.id) {
  console.error('❌ No user ID found');
  setError('User data not available');
  setIsLoading(false);
  return;
}

console.log('📱 ChatScreen - Loading conversations for user:', userData.id);
```

**Replace with:**
```typescript
// Load conversations (auth token is automatically used)
console.log('📱 ChatScreen - Loading conversations via Chat API V2');
```

---

### 3. Verify Socket.IO Connection

The socket connection should happen automatically when app starts.

**Check in:** `/var/www/servicetextpro/mobile-app/App.tsx`

Should have:
```typescript
useEffect(() => {
  const initializeApp = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    const userId = await AsyncStorage.getItem('user_id');
    
    if (token && userId) {
      await SocketIOService.getInstance().connect(token, userId);
    }
  };
  
  initializeApp();
}, []);
```

---

## 📋 TESTING CHECKLIST

After fixes:

### Test 1: Check Socket Connection
- [ ] Open app
- [ ] See log: `🔌 Connecting to Socket.IO /chat namespace...`
- [ ] See log: `✅ Socket.IO connected: [id]`

### Test 2: Load Conversations
- [ ] Go to Chat tab
- [ ] See log: `📱 ChatScreen - Loading conversations via Chat API V2`
- [ ] See log: `✅ Loaded X conversations`
- [ ] Conversations appear in list

### Test 3: Real-time Updates
- [ ] Keep app on chat list
- [ ] Send message from web
- [ ] See log: `📨 New message notification received`
- [ ] Chat preview updates automatically

### Test 4: Notifications
- [ ] Put app in background
- [ ] Send message from web
- [ ] Get notification with sound
- [ ] See log: `📱 Showing notification for message`

---

## 🔑 KEY POINTS

1. **Chat Tokens** are for public SMS links (already working)
2. **Auth Tokens** are for authenticated chat (needs fixing)
3. **Chat API V2** uses auth token automatically (no userId in URL)
4. **Socket.IO** should connect on app start (check App.tsx)

---

## 📁 FILES TO UPDATE

1. `/var/www/servicetextpro/mobile-app/src/services/ApiService.ts` - Fix conversations endpoint
2. `/var/www/servicetextpro/mobile-app/src/screens/ChatScreen.tsx` - Remove userId logic
3. `/var/www/servicetextpro/mobile-app/App.tsx` - Verify socket initialization

---

**Let's fix these 3 files and the chat will work!** 🚀
