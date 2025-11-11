# Mobile App - Bidding System Update

## Summary
Updated mobile app to match the latest web bidding system with winner-only payment, tier-based points, and budget range selection.

---

## Changes Made

### 1. **ApiService.ts** - Updated placeBid Method
**File:** `mobile-app/src/services/ApiService.ts`

**Before:**
```typescript
public async placeBid(caseId: string): Promise<APIResponse>
```

**After:**
```typescript
public async placeBid(
  caseId: string, 
  proposedBudgetRange: string, 
  bidComment?: string
): Promise<APIResponse>
```

**Why:** Backend now requires proposed budget range and optional comment.

---

### 2. **BidModal.tsx** - New Component (Created)
**File:** `mobile-app/src/components/BidModal.tsx`

**Features:**
- ✅ Budget range selection dropdown
- ✅ Real-time point cost calculation
- ✅ Tier-based pricing (FREE/NORMAL/PRO)
- ✅ Confirmation dialog with exact point cost
- ✅ Winner-only payment info
- ✅ Responsive modal design

**Point Calculation Logic:**
```typescript
// FREE tier: 6 pts (1-250), 10 pts (250-500)
// NORMAL tier: 4 pts (1-250), 7 pts (250-500), 12 pts (500-750), etc.
// PRO tier: 3 pts (1-250), 5 pts (250-500), 8 pts (500-750), etc.
```

**UI Flow:**
1. User clicks "Наддай" button
2. Modal opens with budget range selector
3. User selects proposed budget
4. Live preview shows: "⭐ Ако спечелите с оферта 250-500 лв: 10 точки"
5. User clicks "Направи оферта"
6. Confirmation: "Ако спечелите, ще платите: 10 точки"
7. User confirms → Bid placed

---

### 3. **BidButton.tsx** - Simplified Component
**File:** `mobile-app/src/components/BidButton.tsx`

**Changes:**
- Removed complex bidding logic
- Now just opens BidModal
- Changed `budget` prop from `number` to `string` (budget range)
- Removed old point estimation logic

**Before:** Button handled entire bidding flow
**After:** Button opens modal, modal handles bidding

---

## New Bidding Flow

### Old Flow (Before)
1. Click "Наддай" button
2. Generic confirmation
3. Bid placed (no budget selection)
4. 5 points charged immediately

### New Flow (After)
1. Click "Наддай" button
2. **Modal opens** with budget range selector
3. Select proposed budget (e.g., "250-500 лв")
4. See live cost: "10 точки"
5. Click "Направи оферта"
6. Confirmation shows exact cost
7. Bid placed (**0 points charged now**)
8. **If win:** Points charged based on proposed budget

---

## Point Costs by Tier

### FREE Tier (40 points/month, max 500 BGN)
| Proposed Budget | Points if Win |
|-----------------|---------------|
| 1-250 BGN | 6 points |
| 250-500 BGN | 10 points |
| 500+ BGN | ❌ Not allowed |

### NORMAL Tier (150 points/month, max 1500 BGN)
| Proposed Budget | Points if Win |
|-----------------|---------------|
| 1-250 BGN | 4 points |
| 250-500 BGN | 7 points |
| 500-750 BGN | 12 points |
| 750-1000 BGN | 18 points |
| 1000-1500 BGN | 25 points |
| 1500+ BGN | ❌ Not allowed |

### PRO Tier (250 points/month, unlimited)
| Proposed Budget | Points if Win |
|-----------------|---------------|
| 1-250 BGN | 3 points |
| 250-500 BGN | 5 points |
| 500-750 BGN | 8 points |
| 750-1000 BGN | 12 points |
| 1000-1500 BGN | 18 points |
| 1500-2000 BGN | 25 points |
| 2000-3000 BGN | 35 points |
| 3000-4000 BGN | 45 points |
| 4000-5000 BGN | 55 points |

---

## Files Modified

1. **mobile-app/src/services/ApiService.ts**
   - Updated `placeBid()` method signature

2. **mobile-app/src/components/BidModal.tsx** (NEW)
   - Full bidding modal with budget selection
   - Point cost calculation
   - Confirmation dialog

3. **mobile-app/src/components/BidButton.tsx**
   - Simplified to open modal
   - Changed budget prop type

---

## Testing Checklist

### FREE Tier User
- [ ] Can see only 1-250 and 250-500 BGN cases
- [ ] Can select 1-250 BGN → Shows 6 points
- [ ] Can select 250-500 BGN → Shows 10 points
- [ ] Cannot select 500+ BGN ranges
- [ ] Confirmation shows correct point cost
- [ ] 0 points charged when bidding
- [ ] Correct points charged when winning

### NORMAL Tier User
- [ ] Can see cases up to 1500 BGN
- [ ] Point costs match tier pricing
- [ ] Cannot bid on 1500+ BGN cases

### PRO Tier User
- [ ] Can see all cases
- [ ] Point costs match tier pricing
- [ ] Can bid on any budget range

---

## Build & Deploy

```bash
# Navigate to mobile app
cd /var/www/servicetextpro/mobile-app

# Install dependencies (if needed)
npm install @react-native-picker/picker

# Build Android
cd android
./gradlew clean
./gradlew assembleRelease

# APK location
# android/app/build/outputs/apk/release/app-release.apk
```

---

## SCP Commands

```bash
# ApiService
scp root@maystorfix.com:/var/www/servicetextpro/mobile-app/src/services/ApiService.ts D:\newtry1\ServiceTextPro_FRESH\mobile-app\src\services\

# BidModal (NEW)
scp root@maystorfix.com:/var/www/servicetextpro/mobile-app/src/components/BidModal.tsx D:\newtry1\ServiceTextPro_FRESH\mobile-app\src\components\

# BidButton
scp root@maystorfix.com:/var/www/servicetextpro/mobile-app/src/components/BidButton.tsx D:\newtry1\ServiceTextPro_FRESH\mobile-app\src\components\
```

---

## Status
✅ **READY FOR BUILD AND TESTING**

All mobile app files have been updated to match the latest web bidding system.
