# Points + Yearly Subscriptions (VAT incl.) — Implementation Plan

## 0) Final business configuration (source of truth)

### 0.1 Subscription pricing (YEARLY, VAT included)
- **NORMAL:** **349 BGN / 12 months**
- **PRO:** **489 BGN / 12 months**

### 0.2 Included points (granted on subscription activation/renewal)
- **NORMAL:** **350 points / year**
- **PRO:** **500 points / year**

### 0.3 Case access restrictions
- **NORMAL:** can access cases up to **1500 BGN**
- **PRO:** can access **all budgets** (we’ll keep using the existing `7500-10000` bucket for 10000+ as in `PointsService.calculatePointsCost()`)

### 0.4 SMS cost (MUST remain points-based)
- **NORMAL:** **2 points per SMS**
- **PRO:** **1 point per SMS**

### 0.5 Points repurchase (top-up) pricing (VAT included)
- **NORMAL:** **0.30 BGN / point**
- **PRO:** **0.25 BGN / point**

Suggested packs (can be adjusted later):
- Normal: 200 pts = 60 BGN, 500 pts = 150 BGN, 1000 pts = 300 BGN
- Pro: 200 pts = 50 BGN, 500 pts = 125 BGN, 1000 pts = 250 BGN

---

## 1) Final points-per-case table (sqrt proportional)

Budget tiers are already defined in the system:
`1-250`, `250-500`, `500-750`, `750-1000`, `1000-1500`, `1500-2000`, `2000-3000`, `3000-4000`, `4000-5000`, `5000-7500`, `7500-10000`.

### 1.1 NORMAL points-per-case
(With 350 points/year this yields ~18 cases in 1-250)
- 1–250: **19**
- 250–500: **33**
- 500–750: **42**
- 750–1000: **50**
- 1000–1500: **60**
- 1500+ budgets: **not allowed** (enforced by `max_case_budget=1500`)

### 1.2 PRO points-per-case
(PRO is slightly cheaper per case, and supports all tiers)
- 1–250: **17**
- 250–500: **29**
- 500–750: **38**
- 750–1000: **45**
- 1000–1500: **54**
- 1500–2000: **64**
- 2000–3000: **76**
- 3000–4000: **90**
- 4000–5000: **102**
- 5000–7500: **120**
- 7500–10000: **142**

### 1.3 “Cases possible with included points” tables

#### NORMAL (350 points/year)
| Budget tier | Points/case | Cases |
|---|---:|---:|
| 1–250 | 19 | 18 |
| 250–500 | 33 | 10 |
| 500–750 | 42 | 8 |
| 750–1000 | 50 | 7 |
| 1000–1500 | 60 | 5 |
| 1500+ | N/A | 0 |

#### PRO (500 points/year)
| Budget tier | Points/case | Cases |
|---|---:|---:|
| 1–250 | 17 | 29 |
| 250–500 | 29 | 17 |
| 500–750 | 38 | 13 |
| 750–1000 | 45 | 11 |
| 1000–1500 | 54 | 9 |
| 1500–2000 | 64 | 7 |
| 2000–3000 | 76 | 6 |
| 3000–4000 | 90 | 5 |
| 4000–5000 | 102 | 4 |
| 5000–7500 | 120 | 4 |
| 7500–10000 | 142 | 3 |

---

## 2) Current system audit (what exists today)

### 2.1 DB tables confirmed (Postgres)
- `subscription_tiers` (has `price_monthly`, `features jsonb`, `limits jsonb`)
- `sp_subscriptions`
- `sp_subscription_history`
- `users` (has `points_balance`, `points_total_earned`, `points_total_spent`, `points_last_reset`)
- `sp_points_transactions`
- `sp_case_access`

### 2.2 Backend logic found
- Subscription upgrade currently sets **expiresAt = now + 30 days** (`SubscriptionService.upgradeSubscription`)
- Points allowance is stored as `limits.points_monthly` and returned as `monthly_allowance` by `PointsService.getPointsBalance()`
- SMS points cost is implemented in `SMSLimitService`, but currently hardcoded to **1 point for all tiers** (must change).
- `/api/v1/sms/limit-status` already returns points-based status and uses `SMSLimitService`.

### 2.3 Web UI issues found
- Multiple components hardcode **monthly prices** (`250 лв/месец`, `350 лв/месец`) and “на месец”.
- `SMSLimitWidget.tsx` still contains legacy **SMS package purchase UI** (15 SMS for 40 BGN) which conflicts with our points-based SMS model.

### 2.4 Mobile UI issues found
- `AuthScreen.tsx`, `SubscriptionScreen.tsx`, `TierSelectionCard.tsx`, `PointsBalance.tsx`, `PointsScreen.tsx` show “месец/месечно” and/or rely on `monthly_allowance`.

---

## 3) Backend + DB implementation plan

### 3.1 Data model decisions (minimal-risk)
We have two choices:

**Option A (recommended): keep schema, repurpose fields carefully**
- Keep `subscription_tiers.price_monthly` but interpret it as **yearly price** in UI and backend logic.
- Keep `limits.points_monthly` but interpret it as **yearly included points**.

Pros: fewer DB migrations.
Cons: field names are misleading forever.

**Option B (clean): add yearly-specific fields**
- Add `price_yearly` to `subscription_tiers` and keep `price_monthly` unused or set to null.
- Add `limits.points_yearly_included` and keep existing `points_monthly` for backward compat.

Pros: clean and explicit.
Cons: requires DB migration and code updates.

**Decision for implementation:** choose **Option B** unless you explicitly request minimal DB change.

### 3.2 DB migration steps (Option B)
1) Add column:
- `ALTER TABLE subscription_tiers ADD COLUMN price_yearly numeric;`
2) Update tier rows:
- normal: `price_yearly = 349`
- pro: `price_yearly = 489`
- free: `price_yearly = 0`
3) Update `limits` jsonb for each tier:
- `points_yearly_included`: free=0 (or keep existing free rules), normal=350, pro=500
- `max_case_budget`: normal=1500, pro=999999
- Set new points costs:
  - Normal: `points_cost_1_250=19`, `points_cost_250_500=33`, `points_cost_500_750=42`, `points_cost_750_1000=50`, `points_cost_1000_1500=60`, rest=0
  - Pro: fill all as in section 1.2
- Add/Update:
  - `extra_points_price`: normal=0.30, pro=0.25 (BGN/point, VAT incl.)
  - `sms_points_cost`: normal=2, pro=1
4) (Optional) Add `billing_period` metadata in `subscription_tiers` or keep it implicit.

### 3.3 Subscription duration changes (backend)
In `SubscriptionService.upgradeSubscription`:
- Change subscription length from **30 days** to **365 days**.
- Update `next_payment_date` logic accordingly.

### 3.4 Points allocation changes (backend)
Currently points are “monthly allowance”. For the new yearly model:

**Rule:** included points are granted when a subscription is created/renewed.

Implementation:
- On successful subscription upgrade/renewal:
  - Set `users.points_balance = users.points_balance + included_points` OR (preferred) set to included_points if you want “fresh yearly pool”.
  - Record `sp_points_transactions` transaction_type = `reset` or `earned` with reason `Yearly included points (NORMAL/PRO)`.
  - Update `users.points_last_reset = NOW()`.

**Important:** this avoids any cron-based “monthly reset”.
- Keep `PointsService.resetMonthlyPoints()` but stop calling it (or rename to yearly reset).

### 3.5 Points balance API contract
- `PointsService.getPointsBalance()` currently returns `monthly_allowance`.
- Update response to return:
  - `yearly_allowance` (new)
  - keep `monthly_allowance` for backward compatibility (set equal to yearly, or keep as 0 and update mobile/web clients).

### 3.6 SMS points cost enforcement (backend)
- Fix `backend/src/services/SMSLimitService.ts`:
  - Use tier-based mapping: Normal=2, Pro=1 (Free define explicitly, recommended 2).
  - Or read from `subscription_tiers.limits->>'sms_points_cost'`.

### 3.7 Points top-up / purchase flow (backend)
Current backend supports price calculation via `extra_points_price`, but there is no dedicated purchase endpoint for points top-ups.

Add new endpoints under `/api/v1/points` (document in `API_REGISTRY.md`):
- `GET /api/v1/points/topup-options`
  - returns allowed packs and prices for the user tier.
- `POST /api/v1/points/purchase`
  - body: `{ points: number, payment_method: 'manual', payment_reference?: string }`
  - validates tier can purchase (extra_points_price not null)
  - updates `users.points_balance += points`
  - records transaction `earned` with metadata including calculated BGN price.

No external payment integration needed initially (manual flow).

---

## 4) Web (Marketplace) implementation plan

### 4.1 Replace monthly pricing labels with yearly (VAT incl.)
Update hardcoded strings in:
- `Marketplace/src/components/TierSelector.tsx`
- `Marketplace/src/components/TierComparisonTable.tsx`
- `Marketplace/src/app/upgrade-required/page.tsx`
- `Marketplace/src/app/auth/register/page.tsx`
- `Marketplace/src/app/signup/page.tsx`

All should show:
- `349 лв / година (с ДДС)`
- `489 лв / година (с ДДС)`

### 4.2 Remove/replace legacy SMS package UI
- `Marketplace/src/components/SMSLimitWidget.tsx`
  - Currently mentions “15 SMS for 40 BGN” and package history.
  - Replace with points-based display:
    - `SMS cost per message: 2 pts (Normal) / 1 pt (Pro)`
    - `Current points balance`
    - `Go to Buy Points` CTA

### 4.3 Add “Buy Points” page / modal
- Add a simple page (or section in Settings) that:
  - calls `/api/v1/points/topup-options`
  - shows packs
  - calls `/api/v1/points/purchase` (manual)

---

## 5) Mobile App implementation plan

### 5.1 Replace monthly texts with yearly
Update strings & UI in:
- `mobile-app/src/screens/AuthScreen.tsx` (shows `250 лв/месец`, `350 лв/месец`)
- `mobile-app/src/screens/SubscriptionScreen.tsx` (shows `лв/месец`, `точки месечно`)
- `mobile-app/src/components/TierSelectionCard.tsx` (`лв/месец`)
- `mobile-app/src/components/PointsBalance.tsx` (“Месечен лимит”)
- `mobile-app/src/screens/PointsScreen.tsx` (monthly allowance text)

New text format:
- `349 лв / година (с ДДС)`
- `489 лв / година (с ДДС)`
- Points: `Годишни включени точки: 350 / 500`

### 5.2 Add “Buy Points” UI (mobile)
- Add button in `PointsScreen` and/or `SubscriptionScreen`:
  - fetch top-up packs
  - allow manual purchase (calls backend)

### 5.3 Versioning rule (required after meaningful app changes)
- Bump Android app version:
  - `android/app/build.gradle` (`versionName`)
- Update backend app update config:
  - Server config `latestVersion` (file referenced in your rules)

### 5.4 Deliver to your local Android build server
After code changes, provide SCP commands for every changed mobile file to:
`D:\newtry1\ServiceTextPro_FRESH\mobile-app\...`
(as per your workflow).

---

## 6) Deployment / runbook (server)

### 6.1 DB migration
- Run migration SQL (or migration script) against Postgres (superuser).

### 6.2 Backend
- Build backend
- Restart services:
  - `pm2 restart all`

### 6.3 Web (Marketplace)
- Build frontend
- Restart services (if served by pm2/next):
  - `pm2 restart all`

---

## 7) Validation checklist (must pass before commit/push)

### 7.1 Backend/API
- `/api/v1/subscriptions/tiers` returns yearly prices.
- Upgrading to NORMAL/PRO sets subscription expiry ~365 days.
- On upgrade/renewal, points are granted correctly and transaction is recorded.
- `/api/v1/points/check-access` and `/spend` use the new points-per-case table.
- `/api/v1/sms/send-missed-call` deducts **2 pts normal / 1 pt pro**.
- `/api/v1/points/purchase` correctly adds points and records transactions.

### 7.2 Web UI
- All plan cards show yearly VAT prices.
- No “per month” wording remains.
- SMS widget shows points-based info (no package purchase UI).
- Buy points flow works.

### 7.3 Mobile
- All screens show yearly VAT prices.
- Points balance shows yearly allowance.
- Buy points flow works.
- SMS sending consumes correct points.

---

## 8) Open decisions (confirm before implementation)
1) **DB field strategy:** Option A (repurpose existing) vs Option B (add clean yearly fields).
2) **Points grant behavior:**
   - (A) Set balance to included points on renewal, or
   - (B) Add included points on top of remaining balance.
   Recommended: **A** (simple, predictable yearly pool).

---

## 9) Implementation order (recommended)
1) DB migration (tiers + limits)
2) Backend: yearly subscription duration + points grant on upgrade + SMS cost mapping + points purchase endpoints
3) Web updates (prices + SMS widget + buy points)
4) Mobile updates (prices + yearly allowance UI + buy points)
5) Version bump (mobile) + server `latestVersion`
6) Build + `pm2 restart all`

