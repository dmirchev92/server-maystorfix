# SnapFix Marketing Strategy Analysis & Recommendations

**Date:** February 1, 2026  
**Current Phase:** Pre-Launch / Launch Mode  
**Market:** Bulgaria (Service Marketplace)  

---

## Current Strategy Review

### Your Current Plan (Summary)
- **Free Tier:** All features available
- **SMS Limit:** 50 SMS per user per month
- **Duration:** Free for "some months" until both SPs and Customers onboard
- **Goal:** Build two-sided marketplace

### Current Launch Mode Configuration
```json
{
  "monthly_sms_limit": 50,
  "max_case_budget": 999999,
  "max_gallery_photos": 20,
  "max_certificates": 10,
  "max_service_categories": 5,
  "points_cost_all_ranges": 0
}
```

---

## ✅ What's Working in Your Current Strategy

### 1. Smart Two-Sided Problem Solving
- You recognize the chicken-and-egg problem (need SPs to attract customers, need customers to attract SPs)
- Free tier removes friction for both sides

### 2. SMS as Core Differentiator
- 50 SMS/month is generous and practical
- Real feature value, not just "free trial"
- Creates dependency on the platform

### 3. Feature Parity
- Free users get full functionality
- No artificial restrictions
- Builds goodwill and word-of-mouth

### 4. Time-Bound Approach
- "Some months" creates urgency for later monetization
- Not committing to "free forever"

---

## ⚠️ Problems with Current Strategy

### Problem 1: Vague Timeline ("some months")
**Risk:** 
- No clear metrics for when to pivot
- Difficult to communicate to investors/stakeholders
- Procrastination on monetization decisions

### Problem 2: No Clear Success Criteria
**Missing:**
- How many SPs = "enough SPs"?
- How many customers = "enough customers"?
- What case volume triggers monetization?

### Problem 3: Single Tier Approach
**Risk:**
- No upgrade path for power users
- Revenue cliff when you start charging
- Users feel betrayed by sudden change

### Problem 4: 50 SMS Limit is Arbitrary
**Questions:**
- Why 50? Why not 30 or 100?
- Is this based on data or guess?
- What happens after 50 SMS?

### Problem 5: No Customer Acquisition Strategy
**Gap:**
- Your plan covers "what's free" but not "how to get users"
- No marketing channels defined
- No CAC (Customer Acquisition Cost) targets

---

## 🎯 My Recommended Strategy: "Graduated Freemium"

### Core Philosophy
- Start free, but **structure for transition**
- Reward early adopters
- Create natural upgrade paths
- Measure everything

---

## Phase 1: Foundation (Months 1-3)

### Goal: Get First 100 SPs + 500 Customers

#### SP Acquisition Strategy

**Channel 1: Direct Outreach (High Touch)**
| Tactic | Target | Cost | Expected Result |
|--------|--------|------|-----------------|
| SMS to existing tradespersons | 1,000 numbers | 50 BGN | 20 registrations |
| Facebook groups (Bulgarian) | 10 groups | Free | 30 registrations |
| Local business partnerships | 5 companies | Time | 50 registrations |

**Channel 2: Referral Program (Automated)**
- Current: You have referral system (points-based)
- **Enhancement:** 
  - SP refers SP = 100 points (worth 5 BGN)
  - SP refers Customer = 50 points
  - Customer refers Customer = 25 points

**Channel 3: Content Marketing**
- YouTube: "Как да намерим клиенти" (How to find clients)
- TikTok: Quick tips for tradespeople
- Blog: SEO for "ключар софия", "водопроводчик пловдив"

#### Customer Acquisition Strategy

**Channel 1: Google Ads (High Intent)**
- Keywords: "ключар", "електротехник", "водопроводчик" + city names
- Budget: 500 BGN/month
- Expected: 50-100 customer registrations

**Channel 2: Facebook/Instagram Ads**
- Target: Homeowners, 25-55, Bulgaria
- Creative: "Намерете майстор за 5 минути"
- Budget: 300 BGN/month

**Channel 3: Local SEO**
- Google Business Profile for each SP
- Backlinks from Bulgarian directories
- Local citations

### Metrics to Track (Phase 1)

| Metric | Target | Measurement |
|--------|--------|-------------|
| SP Registrations | 100 | Database count |
| Customer Registrations | 500 | Database count |
| Cases Created | 200 | cases table |
| Completed Cases | 50 | cases with status |
| SMS Sent | 2,000 | sms_logs table |
| NPS Score | >40 | Survey |

---

## Phase 2: Growth (Months 4-6)

### Goal: 500 SPs + 2,000 Customers + First Revenue

#### Introduce "Early Adopter" Status

**Reward First 100 SPs:**
- Lifetime "Founder" badge
- 100 SMS/month forever (vs 50 for new users)
- Priority in search results
- 6 months free when monetization starts

**Reward First 500 Customers:**
- "Early User" badge
- First case free (no service fee)
- Premium customer support

#### Introduce Soft Monetization (Testing)

**Option A: Service Fee on Completed Cases**
- 5% fee on completed cases over 100 BGN
- Only on Phase 2 (not early adopters)
- Goes to platform for sustainability

**Option B: Premium SP Tier (Optional)**
- 20 BGN/month for:
  - 150 SMS/month
  - Featured listing in search
  - Analytics dashboard
  - Priority support

**Why this works:**
- Early adopters feel special (retention)
- New users understand platform costs money
- Natural upgrade path established
- Tests willingness to pay

### Metrics to Track (Phase 2)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Monthly Active SPs | 300 | Last 30 days login |
| Monthly Active Customers | 800 | Last 30 days login |
| Monthly Cases | 500 | cases table |
| Revenue (Phase 2) | 1,000 BGN | payments table |
| Conversion to Premium | 5% | subscriptions table |
| Churn Rate | <10% | Cohort analysis |

---

## Phase 3: Monetization (Months 7-12)

### Goal: Sustainable Revenue + Growth

#### Final Tier Structure

**Free Tier (Forever Free):**
- 30 SMS/month
- 3 service categories
- 5 gallery photos
- Standard search ranking
- Community support

**Pro Tier (29 BGN/month):**
- 100 SMS/month
- Unlimited categories
- 20 gallery photos
- Priority search ranking
- Phone number visible to customers
- Analytics dashboard
- Email support

**Business Tier (79 BGN/month):**
- 300 SMS/month
- Everything in Pro
- Top 3 search placement
- Dedicated account manager
- Custom branding
- API access
- Phone support

**Pay-Per-Lead (Alternative):**
- Free tier with 0 SMS
- Buy leads for 5-15 BGN each
- For occasional SPs

#### Customer Revenue

**Service Fee (Standard):**
- 5% of case value (max 50 BGN)
- No fee under 50 BGN
- Waived for first case

**Premium Customer (Optional - 9 BGN/month):**
- Priority case handling
- Verified SPs only
- Price matching guarantee
- Dispute resolution

### Projected Revenue (Month 12)

| Revenue Stream | Assumption | Monthly Revenue |
|----------------|------------|-----------------|
| Pro SPs (100 @ 29 BGN) | 20% of 500 SPs | 2,900 BGN |
| Business SPs (20 @ 79 BGN) | 4% of 500 SPs | 1,580 BGN |
| Service Fees (300 cases) | Avg 100 BGN case, 5% | 1,500 BGN |
| **Total** | | **5,980 BGN/month** |

---

## Alternative Strategy: "Land & Expand"

If you want faster monetization, consider this accelerated approach:

### Month 1-2: Completely Free (Current)
### Month 3: Introduce "Credits System"
- Everyone gets 100 free credits
- SMS = 2 credits
- Bid on case = 5 credits
- Contact customer = 10 credits
- Buy more: 100 credits = 5 BGN

### Why Credits Work Better:
1. **Psychology:** Credits feel like game currency, not real money
2. **Flexibility:** You can adjust credit costs without changing prices
3. **Tracking:** Easy to see what features users value
4. **Transition:** Natural path to subscription ("Get unlimited credits for 29 BGN/month")

---

## Marketing Channel Deep Dive

### Channel 1: Google Ads (Highest ROI for Service Marketplaces)

**Bulgarian Keywords to Target:**
```
High Intent (Bid High):
- ключар софия (locksmith Sofia)
- водопроводчик софия (plumber Sofia)
- електротехник софия (electrician Sofia)
- ремонт пералня (washing machine repair)
- майстор боядисване (painter)

Medium Intent (Bid Medium):
- как да намеря ключар (how to find locksmith)
- майстор за ремонт (handyman for repair)
- ремонтни услуги (repair services)

Low Intent (Bid Low/Content):
- колко струва ключар (how much does locksmith cost)
- съвети за ремонт (repair tips)
```

**Budget Allocation:**
| Keyword Type | Budget % | Expected CPA |
|--------------|----------|--------------|
| High Intent | 60% | 5-10 BGN |
| Medium Intent | 30% | 10-15 BGN |
| Low Intent | 10% | 20-30 BGN |

### Channel 2: Facebook Groups (Free but Time-Intensive)

**Bulgarian Facebook Groups to Target:**
- "София - Купувам/Продавам/Услуги" (Sofia Buy/Sell/Services)
- "Пловдив - Обяви и Услуги" (Plovdiv Ads/Services)
- "Майстори и Ремонти" (Handymen and Repairs)
- "Ключарски Услуги" (Locksmith Services)

**Posting Strategy:**
- Don't spam: 2-3 posts per week
- Provide value: "5 съвета как да изберете ключар" (5 tips to choose a locksmith)
- Soft pitch: "Ако търсите повече клиенти, вижте SnapFix"

### Channel 3: Partnership with Material Suppliers

**Potential Partners:**
- Praktiker (Bulgarian home improvement store)
- HomeMax
- Local plumbing supply stores
- Electrical supply wholesalers

**Pitch:** 
"Your customers need installers. We have installers who need materials. Let's partner."

**Win-Win:**
- They recommend SnapFix to customers looking for installers
- You recommend their stores to SPs who need materials
- Co-marketing opportunities

---

## Critical Success Factors

### 1. Geographic Focus
**Don't:** Launch nationwide immediately  
**Do:** Dominate Sofia first, then expand

**Why:**
- Concentrated marketing budget
- Network effects in one city
- Easier to achieve critical mass
- Better word-of-mouth

### 2. Quality Over Quantity (SP Side)
**Don't:** Accept every SP  
**Do:** Vet SPs with: ID verification, portfolio review, test job

**Why:**
- One bad SP ruins customer experience
- Quality SPs attract quality customers
- Higher completion rates

### 3. Case Completion is King
**Your North Star Metric:** % of cases that complete successfully

**Why this matters most:**
- Customers return if they find good SP
- SPs stay if they make money
- Platform grows organically
- Revenue follows completion

---

## Recommended Immediate Actions

### This Week:
1. ✅ Define specific success metrics (numbers, not "some")
2. ✅ Set up Google Ads account with 500 BGN budget
3. ✅ Create "Founder" tier for first 100 SPs
4. ✅ Build simple landing page for SP recruitment

### This Month:
1. ✅ Run Facebook ad campaign targeting tradespersons
2. ✅ Join 10 Bulgarian Facebook groups, start engaging
3. ✅ Reach out to 5 material suppliers for partnerships
4. ✅ Implement referral tracking dashboard

### This Quarter:
1. ✅ Achieve 100 SPs in Sofia
2. ✅ Achieve 500 customers
3. ✅ Complete 50 cases
4. ✅ Decide on Phase 2 monetization approach

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Not enough SPs sign up | Increase referral rewards, direct outreach |
| SPs don't complete cases | Better vetting, SP training videos |
| Customers don't return | NPS surveys, follow-up campaigns |
| Competitor copies model | Move fast, build brand, lock in SPs |
| Run out of money | Start monetization earlier if needed |

---

## Summary: Your Decision Matrix

| If You Want... | Choose Strategy |
|----------------|-----------------|
| Fastest to revenue | Credits System (Month 3) |
| Lowest risk | Current Plan + clear metrics |
| Maximum growth | Land & Expand (aggressive) |
| Sustainable long-term | Graduated Freemium (recommended) |

---

## My Recommendation

**Go with "Graduated Freemium" but with these changes to your current plan:**

1. **Define "some months" = exactly 6 months** (July 2026 pivot date)
2. **Set targets:** 100 SPs + 500 customers by Month 3, 500 SPs + 2,000 by Month 6
3. **Create Founder tier** for first 100 SPs (100 SMS forever)
4. **Start soft monetization Month 4** (optional Premium tier)
5. **Full monetization Month 7** (Free/Pro/Business tiers)

**Why this works:**
- Clear timeline = accountability
- Founder tier = retention of early adopters
- Soft start = tests market before full commitment
- Data-driven = you know what works before scaling

---

*Marketing Strategy for SnapFix.bg*  
*Prepared: February 1, 2026*  
*Recommendation: Graduated Freemium with Defined Milestones*
