# Subscription Tiers - Quick Start Implementation Guide

## 🚀 Quick Setup (30 minutes)

### Step 1: Run Database Migration (5 min)

```bash
# Connect to PostgreSQL
psql -U postgres -d servicetextpro

# Run the migration
\i /var/www/servicetextpro/backend/migrations/001_add_subscription_tiers.sql

# Verify
SELECT * FROM subscription_tiers;
SELECT * FROM users LIMIT 5;
```

**Expected Result**: 3 tiers (free, normal, pro) created, all existing users set to 'free' tier.

---

### Step 2: Update Backend Server (5 min)

**File**: `/var/www/servicetextpro/backend/src/server.ts`

Add this import:
```typescript
import subscriptionController from './controllers/subscriptionController';
```

Add this route (after other routes):
```typescript
app.use('/api/v1/subscriptions', subscriptionController);
```

**File**: `/var/www/servicetextpro/backend/src/types/index.ts`

Add this export:
```typescript
export * from './subscription';
```

Rebuild and restart:
```bash
cd /var/www/servicetextpro/backend
npm run build
pm2 restart servicetextpro-backend
```

---

### Step 3: Test API Endpoints (5 min)

```bash
# Get all tiers
curl http://localhost:3001/api/v1/subscriptions/tiers

# Get tier comparison
curl http://localhost:3001/api/v1/subscriptions/tiers/comparison

# Get my subscription (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/v1/subscriptions/my-subscription
```

---

### Step 4: Update Mobile App Registration (10 min)

**File**: `/mobile-app/src/screens/AuthScreen.tsx`

1. Import the tier selection component:
```typescript
import { TierSelectionCard, TierData } from '../components/TierSelectionCard';
```

2. Add state for tier selection:
```typescript
const [selectedTier, setSelectedTier] = useState<string>('free');
const [tiers, setTiers] = useState<TierData[]>([
  {
    id: 'free',
    name: 'Free',
    nameBg: 'Безплатен',
    price: 0,
    features: [
      'Основен профил',
      'До 2 категории услуги',
      'До 5 снимки',
      '10 отговора на казуси/месец'
    ]
  },
  {
    id: 'normal',
    name: 'Normal',
    nameBg: 'Нормален',
    price: 250,
    features: [
      'Всички безплатни функции',
      'До 5 категории услуги',
      'До 20 снимки + видео',
      '50 отговора на казуси/месец',
      'Основна аналитика',
      'Значка "Потвърден"'
    ],
    recommended: true
  },
  {
    id: 'pro',
    name: 'Pro',
    nameBg: 'Професионален',
    price: 350,
    features: [
      'Всички нормални функции',
      'Неограничени категории',
      'До 100 снимки',
      'Неограничени отговори',
      'Разширена аналитика',
      'Система за наддаване',
      'Приоритетна поддръжка'
    ]
  }
]);
```

3. Add tier selection UI (after service category field):
```typescript
{!isLogin && (
  <View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>Изберете план</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {tiers.map((tier) => (
        <View key={tier.id} style={{ width: 280, marginRight: 12 }}>
          <TierSelectionCard
            tier={tier}
            selected={selectedTier === tier.id}
            onSelect={setSelectedTier}
          />
        </View>
      ))}
    </ScrollView>
  </View>
)}
```

4. Update registration payload:
```typescript
const response = await ApiService.getInstance().register({
  // ... existing fields
  subscription_tier_id: selectedTier, // ADD THIS
  gdprConsents: ['essential_service'],
});
```

---

### Step 5: Update Web Registration (10 min)

**File**: `/Marketplace/src/app/auth/register/page.tsx`

1. Import component:
```typescript
import TierComparisonTable from '@/components/TierComparisonTable'
```

2. Add state:
```typescript
const [selectedTier, setSelectedTier] = useState<'free' | 'normal' | 'pro'>('free')
```

3. Add tier selection section (after service provider fields):
```typescript
{formData.userType === 'service_provider' && (
  <div className="mt-8">
    <h3 className="text-xl font-semibold mb-4">Изберете вашия план</h3>
    <TierComparisonTable
      selectedTier={selectedTier}
      onSelectTier={setSelectedTier}
      showActions={true}
    />
  </div>
)}
```

4. Update registration payload:
```typescript
const registrationPayload = {
  // ... existing fields
  subscription_tier_id: selectedTier, // ADD THIS
  gdprConsents: ['essential_service']
}
```

---

## 🔧 Common Tasks

### Add Tier Requirement to Endpoint

```typescript
import { requireTier } from '../middleware/subscriptionMiddleware';
import { SubscriptionTier } from '../types/subscription';

// Require PRO tier
router.post('/premium-feature', 
  authenticateToken,
  requireTier(SubscriptionTier.PRO),
  async (req, res) => {
    // Only PRO users can access this
  }
);
```

### Check Feature Access

```typescript
import { checkFeatureAccess } from '../middleware/subscriptionMiddleware';

// Check and increment usage
router.post('/create-case', 
  authenticateToken,
  checkFeatureAccess('case_responses', true),
  async (req, res) => {
    // Feature access checked, usage incremented
  }
);
```

### Get User's Tier in Code

```typescript
import { SubscriptionService } from '../services/SubscriptionService';

const subscriptionService = new SubscriptionService();
const userTier = await subscriptionService.getUserTier(userId);

if (userTier === SubscriptionTier.PRO) {
  // PRO-only logic
}
```

---

## 📊 Monitoring & Analytics

### Check Tier Distribution

```sql
SELECT 
  subscription_tier_id,
  COUNT(*) as user_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM users
WHERE role = 'tradesperson'
GROUP BY subscription_tier_id;
```

### Check Active Subscriptions

```sql
SELECT 
  t.name,
  COUNT(s.id) as active_subscriptions,
  SUM(t.price_monthly) as monthly_revenue
FROM sp_subscriptions s
JOIN subscription_tiers t ON s.tier_id = t.id
WHERE s.status = 'active'
GROUP BY t.name, t.price_monthly;
```

### Feature Usage Report

```sql
SELECT 
  u.email,
  u.subscription_tier_id,
  f.feature_key,
  f.usage_count,
  DATE_TRUNC('month', f.period_start) as month
FROM sp_feature_usage f
JOIN users u ON f.user_id = u.id
WHERE f.period_start >= NOW() - INTERVAL '30 days'
ORDER BY f.usage_count DESC
LIMIT 20;
```

---

## 🐛 Troubleshooting

### Issue: Users not assigned to FREE tier

```sql
UPDATE users 
SET subscription_tier_id = 'free',
    subscription_status = 'active'
WHERE role = 'tradesperson' 
  AND subscription_tier_id IS NULL;
```

### Issue: Tier data not showing in API

Check if migration ran:
```sql
SELECT COUNT(*) FROM subscription_tiers;
-- Should return 3
```

### Issue: Feature access always denied

Check user's tier:
```sql
SELECT id, email, subscription_tier_id, subscription_status 
FROM users 
WHERE email = 'user@example.com';
```

Check tier features:
```sql
SELECT id, name, features, limits 
FROM subscription_tiers 
WHERE id = 'free';
```

---

## 🔐 Security Checklist

- [ ] Tier checks happen on backend (never trust client)
- [ ] Feature limits enforced server-side
- [ ] Usage tracking can't be bypassed
- [ ] Subscription changes logged in history
- [ ] Admin-only endpoints for tier management
- [ ] Rate limiting on subscription endpoints

---

## 📝 Next Steps

1. **Payment Integration** (Future)
   - Add Stripe/PayPal
   - Automated billing
   - Invoice generation

2. **Enhanced Features**
   - Bidding system for PRO users
   - Advanced analytics dashboard
   - Custom branding options

3. **Marketing**
   - Email campaigns for upgrades
   - Trial periods
   - Referral discounts

---

## 📞 Support

For issues or questions:
- Check logs: `pm2 logs servicetextpro-backend`
- Database queries: Use psql or pgAdmin
- API testing: Use Postman or curl

---

**Last Updated**: October 31, 2025
