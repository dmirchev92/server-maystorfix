-- Metrics Tracking for Free Tier Testing Period
-- Date: March 16, 2026
-- Purpose: Track user registrations and SMS usage during testing period

-- ============================================================================
-- 1. USER REGISTRATION METRICS
-- ============================================================================

-- Total Free tier users registered
SELECT COUNT(*) as total_free_users
FROM users 
WHERE subscription_tier_id = 'free';

-- Registrations by date (daily trend)
SELECT 
  DATE(created_at) as registration_date,
  COUNT(*) as new_users
FROM users 
WHERE subscription_tier_id = 'free'
GROUP BY DATE(created_at)
ORDER BY registration_date DESC;

-- Registrations by week
SELECT 
  DATE_TRUNC('week', created_at) as week_start,
  COUNT(*) as new_users
FROM users 
WHERE subscription_tier_id = 'free'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week_start DESC;

-- Registrations by month
SELECT 
  DATE_TRUNC('month', created_at) as month_start,
  COUNT(*) as new_users
FROM users 
WHERE subscription_tier_id = 'free'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month_start DESC;

-- ============================================================================
-- 2. SMS USAGE METRICS PER USER
-- ============================================================================

-- SMS usage per user (total and activity)
SELECT 
  user_id,
  COUNT(*) as total_sms_sent,
  MIN(created_at) as first_sms,
  MAX(created_at) as last_sms,
  COUNT(DISTINCT DATE(created_at)) as active_days
FROM sp_sms_activity
GROUP BY user_id
ORDER BY total_sms_sent DESC;

-- Daily SMS per user
SELECT 
  user_id,
  DATE(created_at) as sms_date,
  COUNT(*) as sms_count
FROM sp_sms_activity
GROUP BY user_id, DATE(created_at)
ORDER BY user_id, sms_date DESC;

-- SMS usage summary statistics
SELECT 
  COUNT(DISTINCT user_id) as users_sent_sms,
  COUNT(*) as total_sms,
  ROUND(AVG(sms_per_user), 2) as avg_sms_per_user,
  MAX(sms_per_user) as max_sms_per_user,
  MIN(sms_per_user) as min_sms_per_user
FROM (
  SELECT user_id, COUNT(*) as sms_per_user
  FROM sp_sms_activity
  GROUP BY user_id
) subquery;

-- SMS usage by Free tier users only
SELECT 
  u.id as user_id,
  u.email,
  u.first_name,
  u.last_name,
  COUNT(sms.id) as total_sms_sent,
  MIN(sms.created_at) as first_sms,
  MAX(sms.created_at) as last_sms
FROM users u
LEFT JOIN sp_sms_activity sms ON u.id = sms.user_id
WHERE u.subscription_tier_id = 'free'
GROUP BY u.id, u.email, u.first_name, u.last_name
ORDER BY total_sms_sent DESC;

-- Daily SMS trend (all users)
SELECT 
  DATE(created_at) as sms_date,
  COUNT(*) as total_sms,
  COUNT(DISTINCT user_id) as unique_users
FROM sp_sms_activity
GROUP BY DATE(created_at)
ORDER BY sms_date DESC;

-- ============================================================================
-- 3. FEATURE USAGE METRICS
-- ============================================================================

-- Case acceptance by budget range (Free tier users)
SELECT 
  c.budget as budget_range,
  COUNT(*) as cases_accepted,
  COUNT(DISTINCT c.provider_id) as unique_providers
FROM marketplace_service_cases c
JOIN users u ON c.provider_id = u.id
WHERE u.subscription_tier_id = 'free'
  AND c.status IN ('assigned', 'in_progress', 'completed')
GROUP BY c.budget
ORDER BY cases_accepted DESC;

-- VIP participation (Free tier users)
SELECT 
  COUNT(DISTINCT user_id) as free_users_with_vip_bids,
  COUNT(*) as total_vip_bids,
  SUM(bid_amount) as total_points_bid
FROM sp_vip_bids vb
JOIN users u ON vb.user_id = u.id
WHERE u.subscription_tier_id = 'free';

-- Points purchases (Free tier users)
SELECT 
  COUNT(DISTINCT user_id) as users_bought_points,
  COUNT(*) as total_purchases,
  SUM(points_amount) as total_points_purchased
FROM sp_points_transactions pt
JOIN users u ON pt.user_id = u.id
WHERE u.subscription_tier_id = 'free'
  AND pt.transaction_type = 'earned'
  AND pt.reason LIKE '%purchase%';

-- Chat activity (Free tier users)
SELECT 
  COUNT(DISTINCT sender_id) as users_sent_messages,
  COUNT(*) as total_messages
FROM chat_messages cm
JOIN users u ON cm.sender_id = u.id
WHERE u.subscription_tier_id = 'free';

-- ============================================================================
-- 4. CONVERSION METRICS
-- ============================================================================

-- Users who upgraded from Free to paid tiers
SELECT 
  COUNT(*) as upgraded_users,
  new_tier,
  COUNT(*) as count_per_tier
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    tier_id as new_tier,
    created_at
  FROM sp_subscription_history
  WHERE tier_id IN ('normal', 'pro')
    AND user_id IN (
      SELECT id FROM users WHERE subscription_tier_id IN ('normal', 'pro')
    )
  ORDER BY user_id, created_at DESC
) upgrades
GROUP BY new_tier;

-- ============================================================================
-- 5. COMBINED DASHBOARD VIEW
-- ============================================================================

-- Overall testing period dashboard
SELECT 
  (SELECT COUNT(*) FROM users WHERE subscription_tier_id = 'free') as total_free_users,
  (SELECT COUNT(*) FROM sp_sms_activity WHERE user_id IN (SELECT id FROM users WHERE subscription_tier_id = 'free')) as total_sms_sent,
  (SELECT COUNT(DISTINCT user_id) FROM sp_sms_activity WHERE user_id IN (SELECT id FROM users WHERE subscription_tier_id = 'free')) as users_sent_sms,
  (SELECT COUNT(*) FROM marketplace_service_cases WHERE provider_id IN (SELECT id FROM users WHERE subscription_tier_id = 'free')) as cases_by_free_users,
  (SELECT COUNT(*) FROM sp_vip_bids WHERE user_id IN (SELECT id FROM users WHERE subscription_tier_id = 'free')) as vip_bids_by_free_users,
  (SELECT COUNT(*) FROM chat_messages WHERE sender_id IN (SELECT id FROM users WHERE subscription_tier_id = 'free')) as messages_by_free_users;
