# Mobile App Chat Issues - Complete Fix Summary

## Date: October 27, 2025, 7:21 PM

## Issues Found and Fixed:

### 1. ❌ **CRITICAL: Wrong API Endpoint for Loading Conversations**
**Location:** `ApiService.ts` line 219

**Problem:**
- Mobile app was calling `/chat/user/${userId}/conversations`
- This endpoint is DISABLED in backend (commented out in server.ts)
- Chat API V2 uses `/chat/conversations` (no userId needed, uses auth token)

**Fix:**
```typescript
// OLD (BROKEN):
public async getConversations(userId: string): Promise<APIResponse> {
  return this.makeRequest(`/chat/user/${userId}/conversations`);
}

// NEW (FIXED):
public async getConversations(): Promise<APIResponse> {
  // Chat API V2 automatically gets conversations for authenticated user
  return this.makeRequest(`/chat/conversations`);
}
```

**Files Changed:**
- `/mobile-app/src/services/ApiService.ts`
- `/mobile-app/src/screens/ChatScreen.tsx`

---

### 2. ❌ **CRITICAL: Sending Messages via Old API Instead of Socket**
**Location:** `ChatDetailScreen.tsx` line 218-232

**Problem:**
- Mobile app was using REST API POST to `/api/v1/chat/messages`
- This doesn't match the web app which uses socket-only messaging
- Causes potential duplicates and doesn't match real-time architecture

**Fix:**
```typescript
// OLD (BROKEN):
const response = await fetch('https://maystorfix.com/api/v1/chat/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ conversationId, senderType: 'provider', ... })
});

// NEW (FIXED):
await socketService.sendMessage(
  conversationId,
  messageText,
  'provider',
  userName,
  'text'
);
```

**Files Changed:**
- `/mobile-app/src/screens/ChatDetailScreen.tsx`

---

### 3. ❌ **CRITICAL: Message Field Name Mismatch**
**Location:** `types/chat.ts` Message interface

**Problem:**
- Backend Chat API V2 uses: `body`, `sentAt`, `type`
- Mobile app expected: `message`, `timestamp`, `messageType`
- Messages from socket/API wouldn't display correctly

**Backend Message Structure (Chat API V2):**
```typescript
{
  id: string
  conversationId: string
  senderType: 'customer' | 'provider'
  senderName: string
  type: 'text' | 'image' | 'file' | 'system' | ...
  body: string          // ← Main message content
  sentAt: string        // ← Timestamp
  isRead: boolean
}
```

**Fix:**
Updated Message interface to support both old and new field names:
```typescript
export interface Message {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'provider' | 'system';
  senderUserId?: string | null;
  senderName: string;
  type: 'text' | 'image' | 'file' | 'system' | ...;  // Chat API V2
  body: string;          // Chat API V2 primary field
  sentAt: string;        // Chat API V2 primary field
  isRead: boolean;
  // Legacy/compatibility fields
  message?: string;      // Maps to body
  timestamp?: string;    // Maps to sentAt
  messageType?: string;  // Legacy
}
```

Added `normalizeMessage()` helper function to handle both formats:
```typescript
const normalizeMessage = (msg: any): Message => ({
  ...msg,
  body: msg.body || msg.message || '',
  message: msg.message || msg.body || '',
  sentAt: msg.sentAt || msg.timestamp || new Date().toISOString(),
  timestamp: msg.timestamp || msg.sentAt || new Date().toISOString(),
  type: msg.type || msg.messageType || 'text',
  isRead: msg.isRead ?? false,
});
```

**Files Changed:**
- `/mobile-app/src/types/chat.ts`
- `/mobile-app/src/screens/ChatDetailScreen.tsx`

---

### 4. ❌ **Conversation Field Name Mismatch**
**Location:** `types/chat.ts` Conversation interface

**Problem:**
- Backend uses: `lastMessageAt`, `status: 'active' | 'archived'`
- Mobile app expected: `lastActivity`, `updatedAt`, `status: 'active' | 'closed'`

**Fix:**
```typescript
export interface Conversation {
  id: string;
  customerId: string;
  providerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  providerName?: string;
  providerBusinessName?: string;
  providerServiceCategory?: string;
  status: 'active' | 'archived';  // Chat API V2
  lastMessageAt: string;          // Chat API V2 (not lastActivity)
  createdAt: string;
  // Optional UI fields
  lastMessage?: string;
  unreadCount?: number;
}
```

**Files Changed:**
- `/mobile-app/src/types/chat.ts`
- `/mobile-app/src/screens/ChatScreen.tsx`

---

### 5. ❌ **Socket Event Name Mismatch**
**Location:** `SocketIOService.ts` line 102, 108

**Problem:**
- Mobile app listened to: `new_message`
- Backend emits: `message:new`

**Fix:**
Already fixed in previous session:
```typescript
// Listen for 'message:new' not 'new_message'
this.socket.on('message:new', (data: { conversationId: string; message: Message }) => {
  const message = data.message;
  this.messageCallbacks.forEach(callback => callback(message));
});
```

**Files Changed:**
- `/mobile-app/src/services/SocketIOService.ts` (already fixed)

---

### 6. ❌ **Socket Namespace Mismatch**
**Location:** `SocketIOService.ts` line 60

**Problem:**
- Mobile app connected to default namespace
- Backend uses `/chat` namespace

**Fix:**
Already fixed in previous session:
```typescript
// Connect to /chat namespace
this.socket = io(`${this.backendUrl}/chat`, {
  auth: { token },
  transports: ['websocket', 'polling'],
  path: '/socket.io',
  ...
});
```

**Files Changed:**
- `/mobile-app/src/services/SocketIOService.ts` (already fixed)

---

## Architecture Summary:

### Web App (Working):
1. **Load conversations**: API `/api/v1/chat/conversations`
2. **Load messages**: API `/api/v1/chat/conversations/:id/messages`
3. **Send message**: Socket `message:send` event
4. **Receive message**: Socket `message:new` event

### Mobile App (Now Fixed to Match):
1. **Load conversations**: API `/api/v1/chat/conversations` ✅
2. **Load messages**: API `/api/v1/chat/conversations/:id/messages` ✅
3. **Send message**: Socket `message:send` event ✅
4. **Receive message**: Socket `message:new` event ✅

---

## Files Modified:

1. `/mobile-app/src/services/ApiService.ts`
   - Changed `getConversations()` to use Chat API V2 endpoint
   - Removed userId parameter

2. `/mobile-app/src/services/SocketIOService.ts`
   - Connect to `/chat` namespace (already done)
   - Use `message:send` and `message:new` events (already done)

3. `/mobile-app/src/types/chat.ts`
   - Updated Message interface to match Chat API V2
   - Updated Conversation interface to match Chat API V2
   - Added backward compatibility fields

4. `/mobile-app/src/screens/ChatScreen.tsx`
   - Use new `getConversations()` without userId
   - Handle Chat API V2 response structure
   - Use `lastMessageAt` instead of `lastActivity`

5. `/mobile-app/src/screens/ChatDetailScreen.tsx`
   - Send messages via socket instead of API
   - Added `normalizeMessage()` helper
   - Handle both old and new field names
   - Display `body` or `message`, `sentAt` or `timestamp`

---

## Testing Checklist:

- [ ] Conversations load on ChatScreen
- [ ] Messages load in ChatDetailScreen
- [ ] Sending message works via socket
- [ ] Receiving message works in real-time
- [ ] No duplicate messages
- [ ] Messages display correctly (text content)
- [ ] Timestamps display correctly
- [ ] Works for both customer and provider roles

---

## Next Steps:

1. Build new APK with these fixes
2. Test on actual device
3. Monitor console logs for any remaining issues
4. Verify real-time message delivery between web and mobile

---

## Key Takeaway:

The main issue was that the mobile app was using **old/disabled API endpoints** and **old field names** that don't exist in Chat API V2. Now it's fully synchronized with the web app and backend.
