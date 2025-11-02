# 🎁 New Referral Rewards System - Complete Guide

## Overview
Updated referral system with SMS-based rewards and subscription tier upgrades based on individual and aggregate referral performance.

---

## Reward Structure

### **Individual Referral Rewards**

Each referral that reaches **50 clicks** earns:

| Milestone | Reward | Description |
|-----------|--------|-------------|
| **50 clicks** | **30 SMS** | Added to addon SMS balance (never expires) |

**Example:**
- Referral #1 reaches 50 clicks → ✅ +30 SMS
- Referral #2 reaches 50 clicks → ✅ +30 SMS
- Referral #3 reaches 50 clicks → ✅ +30 SMS
- **Total earned:** 90 SMS

---

### **Aggregate Rewards (Across All Referrals)**

Based on **total clicks from referrals that reached 50+**:

| Milestone | Referrals Needed | Total Clicks | Reward |
|-----------|------------------|--------------|--------|
| **250 clicks** | **5 referrals** @ 50+ each | 250+ | **1 month FREE Normal plan** |
| **500 clicks** | **10 referrals** @ 50+ each | 500+ | **1 month FREE Pro plan** |

**Important:** Only clicks from referrals that have reached 50+ count toward aggregate totals.

---

## How It Works

### **Dual Progress Tracking**

#### **1. Individual Progress (Per Referral)**

Each referred user has their own progress bar:

```
Referral #1: [████████████████████] 50/50 clicks ✅ 30 SMS earned
Referral #2: [████████░░░░░░░░░░░░] 30/50 clicks ⏳ In progress
Referral #3: [████████████████████] 75/50 clicks ✅ 30 SMS earned
```

#### **2. Aggregate Progress (Overall)**

Shows combined progress toward subscription rewards:

```
┌─────────────────────────────────────────────┐
│  Aggregate Progress: 130 | 250 | 500        │
│  [████████░░░░░░░░░░░░░░░░░░░░░░░░░░]      │
│  130 clicks so far                          │
│  ↓                                          │
│  120 more clicks for Normal plan (250)      │
│  370 more clicks for Pro plan (500)         │
└─────────────────────────────────────────────┘
```

**Format:** `current | normal_milestone | pro_milestone`

---

## Example Scenarios

### **Scenario 1: Starting Out**

```
User has 2 referrals:
- Referral #1: 50 clicks ✅
- Referral #2: 30 clicks ⏳

Individual Rewards:
✅ 30 SMS earned (from Referral #1)

Aggregate Progress:
50 | 250 | 500
- Only Referral #1 counts (reached 50+)
- Need 4 more referrals @ 50+ for Normal plan
- Need 200 more aggregate clicks
```

### **Scenario 2: Approaching Normal Tier**

```
User has 5 referrals:
- Referral #1: 50 clicks ✅
- Referral #2: 50 clicks ✅
- Referral #3: 50 clicks ✅
- Referral #4: 50 clicks ✅
- Referral #5: 50 clicks ✅

Individual Rewards:
✅ 150 SMS earned (5 × 30 SMS)

Aggregate Progress:
250 | 250 | 500
✅ FREE Normal plan for 1 month earned!
- Need 5 more referrals @ 50+ for Pro plan
- Need 250 more aggregate clicks
```

### **Scenario 3: Pro Tier Unlocked**

```
User has 10 referrals:
- All 10 referrals: 50+ clicks each ✅

Individual Rewards:
✅ 300 SMS earned (10 × 30 SMS)

Aggregate Progress:
500 | 250 | 500
✅ FREE Normal plan for 1 month earned!
✅ FREE Pro plan for 1 month earned!
```

### **Scenario 4: Uneven Distribution**

```
User has 3 referrals:
- Referral #1: 50 clicks ✅
- Referral #2: 50 clicks ✅
- Referral #3: 30 clicks ⏳

Individual Rewards:
✅ 60 SMS earned (2 × 30 SMS)

Aggregate Progress:
100 | 250 | 500
- Only 2 referrals count (reached 50+)
- Referral #3 doesn't count yet (< 50)
- Need 3 more referrals @ 50+ for Normal plan
- Need 150 more aggregate clicks
```

---

## Database Schema

### **Updated `referral_rewards` Table**

```sql
CREATE TABLE referral_rewards (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL,
  referral_id TEXT,                    -- NULL for aggregate rewards
  reward_type TEXT NOT NULL,           -- 'sms_30', 'free_normal_month', 'free_pro_month'
  reward_value NUMERIC NOT NULL,       -- 30 for SMS, 1 for free months
  clicks_required INTEGER NOT NULL,    -- 50, 250, 500
  clicks_achieved INTEGER NOT NULL,
  earned_at TIMESTAMP,
  applied_at TIMESTAMP,
  expires_at TIMESTAMP,                -- 6 months from earned_at
  status TEXT,                         -- 'earned', 'applied', 'expired'
  is_aggregate BOOLEAN DEFAULT FALSE   -- NEW: TRUE for 250/500 rewards
);
```

### **Reward Types**

| Type | Value | Description | is_aggregate |
|------|-------|-------------|--------------|
| `sms_30` | 30 | 30 SMS credits | FALSE |
| `free_normal_month` | 1 | 1 month Normal plan | TRUE |
| `free_pro_month` | 1 | 1 month Pro plan | TRUE |

---

## API Endpoints

### **Get Aggregate Progress**

```typescript
GET /api/v1/referrals/aggregate-progress

Response:
{
  "success": true,
  "data": {
    "totalValidClicks": 130,
    "referralsAt50Plus": 2,
    "nextMilestone": 250,
    "progressToNext": 120,
    "earnedRewards": {
      "sms30Count": 2,
      "freeNormalMonth": false,
      "freeProMonth": false
    }
  }
}
```

### **Get Referral Dashboard**

```typescript
GET /api/v1/referrals/dashboard

Response:
{
  "success": true,
  "data": {
    "referralCode": "A3F7B2E9",
    "referralLink": "https://maystorfix.com/signup?ref=A3F7B2E9",
    "referredUsers": [
      {
        "referredUser": {
          "id": "user-123",
          "firstName": "John",
          "lastName": "Doe",
          "businessName": "John's Service"
        },
        "totalClicks": 75,
        "validClicks": 50,
        "monthlyClicks": 10,
        "status": "active",
        "profileUrl": "/provider/user-123"
      }
    ],
    "totalRewards": [
      {
        "id": "reward-1",
        "rewardType": "sms_30",
        "rewardValue": 30,
        "clicksRequired": 50,
        "clicksAchieved": 50,
        "status": "earned",
        "isAggregate": false
      }
    ]
  }
}
```

---

## Reward Logic

### **Individual Reward Award**

```typescript
// When a referral reaches 50 clicks
if (totalClicks >= 50) {
  // Check if reward already awarded
  const existing = await checkExistingReward(referralId, 'sms_30');
  
  if (!existing) {
    await awardReward({
      type: 'sms_30',
      value: 30,
      clicks: 50,
      isAggregate: false,
      referralId: referralId
    });
    
    console.log('✅ Awarded 30 SMS');
  }
}
```

### **Aggregate Reward Award**

```typescript
// Get all referrals with 50+ clicks
const referralsAt50Plus = await getReferralsAbove50(userId);
const totalClicks = referralsAt50Plus.reduce((sum, ref) => sum + ref.clicks, 0);

// Check Normal plan (250 clicks, 5 referrals)
if (totalClicks >= 250 && referralsAt50Plus.length >= 5) {
  const existing = await checkExistingReward(userId, 'free_normal_month');
  
  if (!existing) {
    await awardReward({
      type: 'free_normal_month',
      value: 1,
      clicks: 250,
      isAggregate: true,
      referralId: null  // Aggregate reward
    });
    
    console.log('✅ Awarded FREE Normal plan for 1 month');
  }
}

// Check Pro plan (500 clicks, 10 referrals)
if (totalClicks >= 500 && referralsAt50Plus.length >= 10) {
  const existing = await checkExistingReward(userId, 'free_pro_month');
  
  if (!existing) {
    await awardReward({
      type: 'free_pro_month',
      value: 1,
      clicks: 500,
      isAggregate: true,
      referralId: null  // Aggregate reward
    });
    
    console.log('✅ Awarded FREE Pro plan for 1 month');
  }
}
```

---

## UI Display Format

### **Individual Referral Cards**

```
┌─────────────────────────────────────┐
│ 👤 John Doe (John's Service)       │
├─────────────────────────────────────┤
│ Progress: 50/50 clicks              │
│ [████████████████████] 100%         │
│ ✅ 30 SMS earned                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 👤 Jane Smith (Jane's Repairs)     │
├─────────────────────────────────────┤
│ Progress: 30/50 clicks              │
│ [████████░░░░░░] 60%                │
│ ⏳ 20 more clicks for 30 SMS       │
└─────────────────────────────────────┘
```

### **Aggregate Progress Bar**

```
┌──────────────────────────────────────────────┐
│  🎯 Overall Referral Progress               │
├──────────────────────────────────────────────┤
│  130 | 250 | 500                            │
│  [████████░░░░░░░░░░░░░░░░░░░░░░░░░░]      │
│                                              │
│  Current: 130 clicks (2 referrals @ 50+)    │
│  Next: 120 more for Normal plan             │
│                                              │
│  Rewards Earned:                             │
│  ✅ 60 SMS (2 × 30)                         │
│  ⏳ Normal plan (need 3 more referrals)     │
│  ⏳ Pro plan (need 8 more referrals)        │
└──────────────────────────────────────────────┘
```

---

## Benefits of New System

### **For Users:**
1. ✅ **Clear milestones** - Easy to understand 50/250/500 structure
2. ✅ **Immediate rewards** - Get SMS after each referral reaches 50
3. ✅ **Cumulative progress** - All referrals count toward bigger rewards
4. ✅ **Valuable rewards** - SMS credits + free subscription months

### **For Business:**
1. ✅ **Encourages quality referrals** - Need 50 clicks per referral
2. ✅ **Scales with effort** - More referrals = better rewards
3. ✅ **Retention incentive** - Free months keep users engaged
4. ✅ **SMS monetization** - Rewards align with SMS limit system

---

## Migration Notes

### **Changes from Old System:**

| Old System | New System |
|------------|------------|
| 50 clicks → 10% discount | 50 clicks → 30 SMS |
| 100 clicks → 50% discount | 250 clicks (5 refs) → Normal month |
| 500 clicks → 1 free month | 500 clicks (10 refs) → Pro month |
| Per-referral only | Individual + Aggregate |

### **Database Changes:**
- ✅ Added `is_aggregate` column
- ✅ Updated reward types
- ✅ Added index for aggregate queries
- ✅ Backward compatible (existing rewards untouched)

---

## Summary

**New Referral Reward System:**

1. **Individual:** Each referral @ 50 clicks → 30 SMS
2. **Aggregate:** 5 referrals @ 50+ (250 total) → Free Normal month
3. **Aggregate:** 10 referrals @ 50+ (500 total) → Free Pro month

**Dual Progress Tracking:**
- Individual bars per referral
- Aggregate bar showing `current | 250 | 500`

**All rewards:**
- Expire after 6 months
- Automatically awarded
- Cumulative (can earn all)

**System is LIVE and ready to use!** 🚀
