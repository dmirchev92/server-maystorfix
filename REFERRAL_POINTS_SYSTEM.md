# 🎯 Referral Points System

## Overview
Updated referral system using **bidding points** instead of SMS rewards. Points are added directly to the user's `points_balance` for use in the bidding system.

---

## Reward Structure

### **1. Signup Bonus (Both Users)**
When someone signs up via referral link:
- **Referrer** gets: **+5 points**
- **Referred** gets: **+5 points**

### **2. Individual Milestone (50 Clicks)**
When a referred SP's profile reaches 50 valid clicks:
- **Referrer** gets: **+10 points**

### **3. Aggregate Bonus (5 Referrals × 50 Clicks)**
When 5 different referred SPs each reach 50+ clicks:
- **Referrer** gets: **+100 points BONUS**

---

## Points Value Reference

Based on the bidding system:
- **PRO tier**: 1 point = 4 BGN value
- **NORMAL tier**: 1 point = 5 BGN value

| Reward | Points | Value (PRO) | Value (NORMAL) |
|--------|--------|-------------|----------------|
| Signup (each) | 5 pts | 20 BGN | 25 BGN |
| 50 clicks | 10 pts | 40 BGN | 50 BGN |
| 5×50 aggregate | 100 pts | 400 BGN | 500 BGN |

---

## Example: Successful Referral Journey

| Milestone | Referrer Points | Referred Points |
|-----------|-----------------|-----------------|
| SP signs up via referral | +5 pts | +5 pts |
| SP profile reaches 50 clicks | +10 pts | - |
| **Subtotal per referral** | **15 pts** | **5 pts** |

### Aggregate Bonus Example
If you refer 5 SPs and each reaches 50+ clicks:
- Signup bonuses: 5 × 5 = 25 pts
- 50-click bonuses: 5 × 10 = 50 pts
- Aggregate bonus: 100 pts
- **Total: 175 points** (worth 700-875 BGN in bids!)

---

## Database Changes

### New Reward Types
| Type | Points | Condition | is_aggregate |
|------|--------|-----------|--------------|
| `signup_bonus` | 5 | Referred signs up | FALSE |
| `referrer_signup_bonus` | 5 | Someone uses your code | FALSE |
| `clicks_50_bonus` | 10 | Referral gets 50 clicks | FALSE |
| `aggregate_5x50_bonus` | 100 | 5 referrals at 50+ clicks | TRUE |

### New Columns
- `referral_rewards.points_awarded` - Actual points given
- `referral_rewards.referred_user_id` - The user who was referred

---

## Removed Features
- ❌ SMS-based rewards (sms_30, free_normal_month, free_pro_month)
- ❌ SMS claim tokens
- ❌ Tier-based SMS limits

---

## API Endpoints

Existing endpoints work with new data:
- `GET /api/v1/referrals/dashboard` - Shows points-based rewards
- `GET /api/v1/referrals/aggregate-progress` - Shows progress to 5×50 bonus

---

## UI Changes

### Mobile App (ReferralDashboardScreen)
- Shows points instead of SMS
- Updated reward tiers display

### Web (ReferralWidget)
- Shows points progress
- Removed SMS claim buttons
- Shows "+10 точки добавени" when 50 clicks reached

---

## Summary

| Action | Points |
|--------|--------|
| Refer someone (you) | +5 pts |
| Get referred (them) | +5 pts |
| Referral hits 50 clicks (you) | +10 pts |
| 5 referrals × 50 clicks (you) | +100 pts |

**Maximum per referral: 15 points**
**Aggregate bonus: 100 points (one-time)**
