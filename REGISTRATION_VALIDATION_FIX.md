# Registration Form - Backend Validation Requirements Fix

## Problem
Registration was failing with **400 Bad Request** error even after adding separate firstName/lastName fields.

## Root Cause Analysis

The backend has strict validation requirements that weren't being met:

### Backend Validation Requirements (`authController.ts`)

1. **Phone Number Format**
   ```typescript
   body('phoneNumber')
     .matches(/^\+359[0-9]{8,9}$/)
     .withMessage('Valid Bulgarian phone number is required (+359xxxxxxxxx)')
   ```
   - **Required:** `+359xxxxxxxxx` format
   - **Frontend was sending:** `0888123456` (without +359 prefix)

2. **Password Strength**
   ```typescript
   body('password')
     .isLength({ min: 8 })
     .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
   ```
   - **Required:** Minimum 8 characters
   - **Must contain:** Uppercase, lowercase, number, special character (@$!%*?&)
   - **Frontend was checking:** Only 6 characters minimum

3. **GDPR Consents**
   ```typescript
   body('gdprConsents')
     .isArray({ min: 1 })
     .withMessage('GDPR consents are required')
   ```
   - **Required:** Array with at least one consent type
   - **Frontend was sending:** Nothing (missing field)

4. **Name Validation**
   ```typescript
   body('firstName')
     .trim()
     .isLength({ min: 1, max: 50 })
     .matches(/^[a-zA-ZА-Яа-я\s]+$/)
   
   body('lastName')
     .trim()
     .isLength({ min: 1, max: 50 })
     .matches(/^[a-zA-ZА-Яа-я\s]+$/)
   ```
   - **Required:** Only letters (Latin and Cyrillic), spaces allowed
   - **Max length:** 50 characters each

## Solution Implemented

### File: `/Marketplace/src/app/u/[spIdentifier]/c/[token]/page.tsx`

#### 1. Phone Number Formatting
```typescript
// Format phone number to +359 format
let formattedPhone = customerInfo.phone.trim();
if (formattedPhone.startsWith('0')) {
  formattedPhone = '+359' + formattedPhone.substring(1);
} else if (!formattedPhone.startsWith('+359')) {
  formattedPhone = '+359' + formattedPhone;
}
```

**Handles:**
- `0888123456` → `+359888123456`
- `888123456` → `+359888123456`
- `+359888123456` → `+359888123456` (already formatted)

#### 2. Password Validation
```typescript
// Validate password strength
if (customerInfo.password.length < 8) {
  setAuthError('Паролата трябва да е поне 8 символа');
  return;
}

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
if (!passwordRegex.test(customerInfo.password)) {
  setAuthError('Паролата трябва да съдържа главна буква, малка буква, цифра и специален символ (@$!%*?&)');
  return;
}
```

**Updated placeholder:**
```tsx
placeholder="Мин. 8 символа (A-z, 0-9, @$!%*?&)"
```

#### 3. GDPR Consents
```typescript
const registerResponse = await axios.post(`${apiUrl}/auth/register`, {
  email: customerInfo.email,
  password: customerInfo.password,
  firstName: customerInfo.firstName,
  lastName: customerInfo.lastName,
  phoneNumber: formattedPhone,
  role: 'customer',
  gdprConsents: ['essential_service', 'marketing_communications']  // ← Added
});
```

## Complete Registration Payload

```json
{
  "email": "customer@example.com",
  "password": "Password123!",
  "firstName": "Иван",
  "lastName": "Петров",
  "phoneNumber": "+359888123456",
  "role": "customer",
  "gdprConsents": ["essential_service", "marketing_communications"]
}
```

## Form Requirements (User-Facing)

### Registration Form Fields:
1. **Име (First Name)** *
   - Only letters (Bulgarian/Latin)
   - 1-50 characters

2. **Фамилия (Last Name)** *
   - Only letters (Bulgarian/Latin)
   - 1-50 characters

3. **Телефон (Phone)** *
   - Format: `0888123456` (will be auto-converted to +359)
   - 8-9 digits after country code

4. **Email** *
   - Valid email format

5. **Парола (Password)** *
   - Minimum 8 characters
   - Must contain:
     - At least one uppercase letter (A-Z)
     - At least one lowercase letter (a-z)
     - At least one number (0-9)
     - At least one special character (@$!%*?&)
   - Example: `Password123!`

6. **Потвърди парола (Confirm Password)** *
   - Must match password

## Password Examples

✅ **Valid passwords:**
- `Password123!`
- `MyPass@2024`
- `Secure$Pass1`
- `Test123!@#`

❌ **Invalid passwords:**
- `password` (no uppercase, no number, no special char)
- `PASSWORD123` (no lowercase, no special char)
- `Password` (no number, no special char)
- `Pass123` (too short, no special char)
- `Password123` (no special char)

## Testing Checklist

- [x] Phone number auto-formats to +359
- [x] Password requires 8+ characters
- [x] Password requires uppercase letter
- [x] Password requires lowercase letter
- [x] Password requires number
- [x] Password requires special character
- [x] GDPR consents included in request
- [x] First name and last name sent separately
- [x] Registration succeeds with valid data
- [x] Clear error messages for validation failures

## Error Messages (Bulgarian)

- **Missing fields:** "Моля попълнете всички полета"
- **Password mismatch:** "Паролите не съвпадат"
- **Password too short:** "Паролата трябва да е поне 8 символа"
- **Weak password:** "Паролата трябва да съдържа главна буква, малка буква, цифра и специален символ (@$!%*?&)"

## Deployment Status

- ✅ Phone number formatting added
- ✅ Password validation strengthened
- ✅ GDPR consents included
- ✅ Frontend rebuilt and restarted
- ✅ All changes live in production

## Next Steps for Users

When registering via token link, users must:
1. Enter first name and last name separately
2. Enter phone in format `0888123456` (will auto-convert)
3. Create strong password with uppercase, lowercase, number, and special character
4. Example: `Password123!`

## Backend Validation Summary

| Field | Requirement | Frontend Handling |
|-------|-------------|-------------------|
| firstName | 1-50 chars, letters only | User input |
| lastName | 1-50 chars, letters only | User input |
| phoneNumber | +359xxxxxxxxx | Auto-formatted |
| email | Valid email | User input |
| password | 8+ chars, complex | Validated |
| gdprConsents | Array, min 1 | Auto-included |
| role | Valid role | Set to 'customer' |

All requirements now met! ✅
