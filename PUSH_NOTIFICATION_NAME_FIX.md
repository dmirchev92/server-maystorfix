# Push Notification Name Fix

## 🐛 Issue
Push notifications were showing "New message from undefined" instead of the sender's actual name.

## 🔍 Root Cause
The JWT token payload did not include `firstName` and `lastName` fields. When the code tried to build `userName` from the JWT token, it was concatenating `undefined + ' ' + undefined`, resulting in "undefined undefined" being used as the sender name in push notifications.

The JWT payload only contained: `userId`, `email`, `role`, and `businessId` - but not the user's name fields.

### Affected Files
1. `/backend/src/socket/chatSocket.ts` - Line 65 (Socket.IO authentication)
2. `/backend/src/controllers/chatControllerV2.ts` - Line 143 (REST API endpoint)

## ✅ Solution
**Two-part fix:**

### Part 1: Add firstName/lastName to JWT Payload
Updated the JWT token generation to include user name fields.

**File:** `/backend/src/types/index.ts`
```typescript
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  firstName?: string;  // ← Added
  lastName?: string;   // ← Added
  businessId?: string;
  iat: number;
  exp: number;
}
```

**File:** `/backend/src/services/AuthService.ts`
```typescript
const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
  userId: user.id,
  email: user.email,
  role: user.role,
  firstName: user.firstName,  // ← Added
  lastName: user.lastName,    // ← Added
  businessId: user.businessId
};
```

### Part 2: Add Fallback Logic
Added proper fallback logic to handle cases where name fields might still be missing:

### Before
```typescript
// Socket
socket.userName = decoded.firstName + ' ' + decoded.lastName

// Controller
const userName = (req as any).user?.firstName + ' ' + (req as any).user?.lastName
```

### After
```typescript
// Socket
const firstName = decoded.firstName || decoded.first_name || ''
const lastName = decoded.lastName || decoded.last_name || ''
socket.userName = (firstName + ' ' + lastName).trim() || decoded.email || decoded.phoneNumber || 'User'

// Controller
const user = (req as any).user
const firstName = user?.firstName || user?.first_name || ''
const lastName = user?.lastName || user?.last_name || ''
const userName = (firstName + ' ' + lastName).trim() || user?.email || user?.phoneNumber || 'User'
```

## 🎯 Fallback Chain
The fix implements a robust fallback chain:
1. **First attempt:** `firstName + lastName` (camelCase)
2. **Second attempt:** `first_name + last_name` (snake_case)
3. **Third attempt:** `email` (if name fields are empty)
4. **Fourth attempt:** `phoneNumber` (if email is also missing)
5. **Final fallback:** `'User'` (if all else fails)

## 📱 Result
Push notifications now show:
- ✅ "New message from John Smith" (when name is available)
- ✅ "New message from john@example.com" (when only email is available)
- ✅ "New message from +1234567890" (when only phone is available)
- ✅ "New message from User" (as absolute last resort)

Instead of:
- ❌ "New message from undefined"

## 🔧 Files Modified
- `/var/www/servicetextpro/backend/src/types/index.ts` - Added firstName/lastName to JWTPayload
- `/var/www/servicetextpro/backend/src/services/AuthService.ts` - Include names in token generation
- `/var/www/servicetextpro/backend/src/socket/chatSocket.ts` - Add fallback logic for userName
- `/var/www/servicetextpro/backend/src/controllers/chatControllerV2.ts` - Add fallback logic for userName

## 🚀 Impact
- ✅ All push notifications will now show proper sender names
- ✅ Works for both Socket.IO and REST API message sending
- ✅ Handles both camelCase and snake_case field names
- ✅ Graceful fallback to email/phone/generic name
- ✅ No breaking changes to existing functionality
