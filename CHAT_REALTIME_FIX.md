# Real-Time Chat Fix Documentation

## Date: October 27, 2025

## Problem Summary
The real-time chat system was experiencing multiple critical issues:
1. **Duplicate messages** appearing on sender's side
2. **Messages not appearing in real-time** - required page refresh to see new messages
3. **Intermittent socket disconnections**
4. **Messages appearing only after refresh** on receiver's side

## Root Causes Identified

### 1. Multiple Socket Connections (Duplicate Sockets)
**Problem:** Multiple components were creating their own socket connections:
- `SocketProvider` in global providers
- `ChatProvider` wrapping ChatWidget
- `ChatProvider` wrapping Chat page
- Provider chat page creating its own socket

**Result:** 4 simultaneous socket connections per user, causing conflicts and duplicate messages.

**Files Affected:**
- `/Marketplace/src/app/providers.tsx`
- `/Marketplace/src/components/ChatWidget.tsx`
- `/Marketplace/src/app/chat/page.tsx`
- `/Marketplace/src/app/provider/chat/[conversationId]/page.tsx`

### 2. Socket Namespace Mismatch
**Problem:** Frontend connecting to default namespace, backend emitting to `/chat` namespace.
- Frontend: `io(socketUrl)` → default namespace
- Backend: `io.of('/chat')` → /chat namespace

**Result:** Events never received because they were on different namespaces.

**Files Affected:**
- `/Marketplace/src/contexts/SocketContext.tsx`
- `/backend/src/socket/chatSocket.ts`

### 3. Optimistic Updates + Socket Events = Duplicates
**Problem:** Hybrid approach causing duplicates:
1. Optimistic update adds temp message
2. API call replaces temp with real message
3. Socket event receives same message and adds it again

**Result:** Duplicate messages on sender's side.

**Files Affected:**
- `/Marketplace/src/contexts/ChatContext.tsx`

### 4. Unnecessary API Polling
**Problem:** ChatWidget polling API every 3 seconds for new messages.

**Result:** Unnecessary server load and potential race conditions with socket updates.

**Files Affected:**
- `/Marketplace/src/components/ChatWidget.tsx`

### 5. Socket Lifecycle Issues
**Problem:** Socket disconnecting on every re-render due to dependency arrays:
- `SocketProvider` depending on `[isAuthenticated]`
- `ChatContext` depending on `[globalSocket, isAuthenticated]`

**Result:** Constant connect/disconnect cycles, messages lost during disconnections.

**Files Affected:**
- `/Marketplace/src/contexts/SocketContext.tsx`
- `/Marketplace/src/contexts/ChatContext.tsx`

### 6. PM2 Cluster Mode Issue (THE CRITICAL ONE)
**Problem:** Backend running in cluster mode with 2 instances:
- User connects to instance 1
- Message sent to instance 2
- Instance 2 doesn't have user in its `userSockets` Map
- Message not delivered

**Result:** Messages saved to database but not delivered via socket in real-time.

**Files Affected:**
- `/ecosystem.config.js`
- `/backend/src/socket/chatSocket.ts`

## Solutions Implemented

### 1. Single Global Socket Architecture
**Solution:** Consolidated to ONE socket connection per user via global `SocketProvider`.

**Changes:**
```typescript
// /Marketplace/src/app/providers.tsx
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthProvider>
        <SocketProvider>          // Single global socket
          <ChatProvider>          // Uses global socket
            <ChatWidgetProvider>
              {children}
            </ChatWidgetProvider>
          </ChatProvider>
        </SocketProvider>
      </AuthProvider>
    </Provider>
  )
}
```

**Removed:**
- ChatProvider wrapper from ChatWidget
- ChatProvider wrapper from Chat page
- Local socket creation in provider chat page

### 2. Fixed Socket Namespace
**Solution:** Frontend now connects to `/chat` namespace to match backend.

**Changes:**
```typescript
// /Marketplace/src/contexts/SocketContext.tsx
const socketInstance = io(`${socketUrl}/chat`, {  // Added /chat
  auth: {
    token: localStorage.getItem('auth_token') || localStorage.getItem('token')
  },
  transports: ['websocket', 'polling'],
  path: '/socket.io'
})
```

### 3. Socket-Only Messaging (No API)
**Solution:** Send messages via socket only, eliminating optimistic updates.

**Changes:**
```typescript
// /Marketplace/src/contexts/ChatContext.tsx
const sendMessage = useCallback(async (
  conversationId: string,
  body: string,
  type: Message['type'] = 'text'
) => {
  // Send via socket only - no API, no optimistic update
  socketRef.current.emit('message:send', {
    conversationId,
    type,
    body
  })
}, [user])
```

**Backend already had `message:send` handler:**
```typescript
// /backend/src/socket/chatSocket.ts
socket.on('message:send', async (data) => {
  const message = await this.chatService.sendMessage(...)
  await this.emitConversationUpdate(data.conversationId, userId, message)
})
```

### 4. Removed API Polling
**Solution:** Removed 3-second interval polling from ChatWidget.

**Changes:**
```typescript
// /Marketplace/src/components/ChatWidget.tsx
// REMOVED:
// const interval = setInterval(() => {
//   if (isOpen) {
//     loadConversations()
//   }
// }, 3000)

// NOW: Load once on open, socket handles updates
useEffect(() => {
  if (isOpen && isAuthenticated) {
    loadConversations()
    // No polling needed - socket handles real-time updates
  }
}, [isOpen, isAuthenticated, loadConversations])
```

### 5. Fixed Socket Lifecycle
**Solution:** Socket created once on mount, no dependencies causing re-creation.

**Changes:**
```typescript
// /Marketplace/src/contexts/SocketContext.tsx
useEffect(() => {
  const socketInstance = io(`${socketUrl}/chat`, {...})
  
  setSocket(socketInstance)
  
  return () => {
    socketInstance.disconnect()
  }
}, []) // Empty deps - only run once on mount
```

```typescript
// /Marketplace/src/contexts/ChatContext.tsx
useEffect(() => {
  // Setup event listeners
  socket.on('message:new', ...)
  
  return () => {
    // Cleanup listeners
    socket.off('message:new')
  }
}, [globalSocket?.id]) // Only re-run if socket ID changes (actual reconnection)
```

### 6. Fixed Cluster Mode Issue
**Solution:** Changed from cluster mode (2 instances) to single instance.

**Changes:**
```javascript
// /ecosystem.config.js
{
  name: 'servicetextpro-backend',
  instances: 1,        // Changed from 2
  exec_mode: 'fork',   // Changed from 'cluster'
}
```

**Alternative (for future scaling):**
To use cluster mode properly, implement Redis adapter:
```bash
npm install @socket.io/redis-adapter redis
```

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

## Current Architecture

### Message Flow
1. **User sends message:**
   - Frontend emits `message:send` via socket
   - Backend receives, saves to database
   - Backend emits `message:new` to both users via their personal rooms
   - Both users receive and display message in real-time

2. **User receives message:**
   - Socket listener receives `message:new` event
   - Checks for duplicates (by message ID)
   - Adds message to UI

### Socket Connection
- **One global socket per user** created by `SocketProvider`
- Connects to `/chat` namespace
- Stays connected for entire session
- Only disconnects on logout or browser close

### Event Listeners
- `message:new` - New message received
- `message:updated` - Message edited
- `message:deleted` - Message deleted
- `conversation:updated` - Conversation metadata updated
- `typing` - Typing indicators
- `presence` - User online/offline status

## API Usage (Minimal)
API is now used ONLY for:
1. Initial load of conversations (when widget opens)
2. Initial load of messages (when conversation opens)
3. Mark as read
4. Edit/delete messages (if implemented)

**No more:**
- ❌ Sending messages via API
- ❌ Polling for new messages
- ❌ Optimistic updates

## Testing Checklist
- [x] Messages appear in real-time on both sender and receiver
- [x] No duplicate messages
- [x] No need to refresh to see messages
- [x] Socket stays connected throughout session
- [x] Messages sent rapidly all appear correctly
- [x] Works across different browsers/devices

## Performance Improvements
1. **Reduced server load:** No more 3-second polling from every user
2. **Faster message delivery:** Direct socket emission vs API + socket
3. **Lower latency:** Single socket connection vs multiple
4. **Better UX:** Instant message appearance, no optimistic update flicker

## Known Limitations
1. **Single backend instance:** For high load, need Redis adapter for cluster mode
2. **No offline message queue:** Messages sent while disconnected are lost (could add retry logic)
3. **No message persistence on frontend:** Refresh loads from API (could add IndexedDB)

## Future Improvements
1. **Redis adapter** for cluster mode support
2. **Sticky sessions** as alternative to Redis
3. **Message retry logic** for failed sends
4. **Offline queue** for messages sent while disconnected
5. **IndexedDB** for message caching
6. **Service Worker** for background sync
7. **Read receipts** via socket events
8. **Typing indicators** implementation
9. **File upload** via socket

## Files Modified

### Frontend
- `/Marketplace/src/app/providers.tsx` - Added global ChatProvider
- `/Marketplace/src/contexts/SocketContext.tsx` - Fixed lifecycle, namespace
- `/Marketplace/src/contexts/ChatContext.tsx` - Socket-only messaging, fixed dependencies
- `/Marketplace/src/components/ChatWidget.tsx` - Removed polling, removed ChatProvider wrapper
- `/Marketplace/src/app/chat/page.tsx` - Removed ChatProvider wrapper
- `/Marketplace/src/app/provider/chat/[conversationId]/page.tsx` - Use global socket

### Backend
- `/backend/src/socket/chatSocket.ts` - Added emitConversationUpdate method, fixed logging
- `/ecosystem.config.js` - Changed to single instance

## Rollback Instructions
If issues occur, rollback by:
1. Revert `/ecosystem.config.js` to cluster mode
2. Revert to API-based messaging in ChatContext
3. Add back polling in ChatWidget

## Monitoring
Check backend logs for:
```bash
pm2 logs servicetextpro-backend | grep "Chat socket connected"
pm2 logs servicetextpro-backend | grep "MESSAGE TO USERS"
pm2 logs servicetextpro-backend | grep "EMIT TO USER"
```

Should see:
- Stable socket connections (no rapid connect/disconnect)
- Messages emitted to both users
- No "NO SOCKETS" warnings

## Conclusion
The real-time chat now works reliably with:
- ✅ Single global socket connection
- ✅ Pure socket-based messaging
- ✅ No duplicates
- ✅ True real-time delivery
- ✅ Stable connections
- ✅ Single backend instance

The main issue was **PM2 cluster mode** causing socket tracking to fail across instances. Combined with multiple socket connections and namespace mismatches, this created a perfect storm of issues. All have been resolved.
