# Token Registration Form - Separate Name Fields Fix

## Problems Fixed

### 1. Mixed Content Error (HTTP on HTTPS)
**Error:**
```
Mixed Content: The page at 'https://maystorfix.com/settings/sms' was loaded over HTTPS, 
but requested an insecure resource 'http://46.224.11.139:3000/api/v1/chat/tokens/regenerate'
```

**Solution:**
Updated `.env.production.local` to use HTTPS:
```bash
# Before
NEXT_PUBLIC_API_URL=http://46.224.11.139:3000/api/v1

# After
NEXT_PUBLIC_API_URL=https://maystorfix.com/api/v1
```

### 2. Registration Form - Missing Last Name
**Error:**
```
POST https://maystorfix.com/api/v1/auth/register 400 (Bad Request)
```

**Problem:**
- Form had single "name" field
- Backend expected separate `firstName` and `lastName`
- Code was splitting name string, but if user entered only first name, `lastName` was empty string
- Backend validation requires both fields

**Solution:**
Added separate input fields for first name and last name.

## Changes Made

### File: `/Marketplace/src/app/u/[spIdentifier]/c/[token]/page.tsx`

#### 1. Updated State Structure
```typescript
// Before
const [customerInfo, setCustomerInfo] = useState({
  name: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: ''
});

// After
const [customerInfo, setCustomerInfo] = useState({
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: ''
});
```

#### 2. Updated Registration API Call
```typescript
// Before
const registerResponse = await axios.post(`${apiUrl}/auth/register`, {
  email: customerInfo.email,
  password: customerInfo.password,
  firstName: customerInfo.name.split(' ')[0] || customerInfo.name,
  lastName: customerInfo.name.split(' ').slice(1).join(' ') || '',
  phoneNumber: customerInfo.phone,
  role: 'customer'
});

// After
const registerResponse = await axios.post(`${apiUrl}/auth/register`, {
  email: customerInfo.email,
  password: customerInfo.password,
  firstName: customerInfo.firstName,
  lastName: customerInfo.lastName,
  phoneNumber: customerInfo.phone,
  role: 'customer'
});
```

#### 3. Updated Form UI
```tsx
{/* Before - Single name field */}
<div>
  <label htmlFor="name">Име *</label>
  <input
    type="text"
    id="name"
    value={customerInfo.name}
    onChange={(e) => handleCustomerInfoChange('name', e.target.value)}
    placeholder="Вашето име"
    required
  />
</div>

{/* After - Separate firstName and lastName fields */}
<div>
  <label htmlFor="firstName">Име *</label>
  <input
    type="text"
    id="firstName"
    value={customerInfo.firstName}
    onChange={(e) => handleCustomerInfoChange('firstName', e.target.value)}
    placeholder="Вашето име"
    required
  />
</div>

<div>
  <label htmlFor="lastName">Фамилия *</label>
  <input
    type="text"
    id="lastName"
    value={customerInfo.lastName}
    onChange={(e) => handleCustomerInfoChange('lastName', e.target.value)}
    placeholder="Вашата фамилия"
    required
  />
</div>
```

#### 4. Updated All References
- Message sender name: `${customerInfo.firstName} ${customerInfo.lastName}`.trim()
- Conversation updates: `${customerInfo.firstName} ${customerInfo.lastName}`.trim()
- Validation checks: `!customerInfo.firstName` instead of `!customerInfo.name`

### File: `/Marketplace/.env.production.local`
```bash
# Updated API URL to use HTTPS
NEXT_PUBLIC_API_URL=https://maystorfix.com/api/v1
```

## Registration Flow After Fix

1. **Customer opens token link:** `https://maystorfix.com/u/{spIdentifier}/c/{token}`
2. **Sees registration form with fields:**
   - Име (First Name) *
   - Фамилия (Last Name) *
   - Телефон (Phone) *
   - Email *
   - Парола (Password) *
   - Потвърди парола (Confirm Password) *

3. **Fills all fields and submits**
4. **Backend receives:**
   ```json
   {
     "email": "customer@example.com",
     "password": "******",
     "firstName": "Иван",
     "lastName": "Петров",
     "phoneNumber": "0888123456",
     "role": "customer"
   }
   ```

5. **Registration succeeds** ✅
6. **Auto-login and redirect to main page with chat open**

## Testing Checklist

- [x] Form displays separate firstName and lastName fields
- [x] Both fields are marked as required
- [x] Registration submits correct data structure
- [x] Backend accepts registration (no 400 error)
- [x] Auto-login works after registration
- [x] Conversation updates with full customer name
- [x] No mixed content errors (all HTTPS)
- [x] WebSocket connects over WSS (secure)

## Deployment Status

- ✅ Frontend rebuilt with updated form
- ✅ Frontend restarted (PM2)
- ✅ Environment variable updated to HTTPS
- ✅ All changes live in production

## Benefits

1. **Better UX:** Clear separate fields for first and last name
2. **Data Quality:** Ensures both names are captured correctly
3. **Backend Compatibility:** Matches expected API structure
4. **Security:** All requests now over HTTPS/WSS
5. **No More Errors:** Registration works reliably

## URL to Test

https://maystorfix.com/u/wNw_/c/X9P4LQO8LTGB

(Note: Token may be expired, generate new one from SMS settings)
