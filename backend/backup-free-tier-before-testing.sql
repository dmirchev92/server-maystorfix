-- Backup Free tier configuration before testing period
-- Date: March 16, 2026
-- Purpose: Save current Free tier limits for rollback after testing period

-- Export current Free tier configuration
COPY (
  SELECT 
    id,
    name,
    price_monthly,
    price_yearly,
    currency,
    limits,
    features,
    display_order,
    is_active,
    created_at,
    updated_at
  FROM subscription_tiers 
  WHERE id = 'free'
) TO '/tmp/free_tier_backup_2026_03_16.csv' WITH CSV HEADER;

-- Also create a table backup
CREATE TABLE IF NOT EXISTS subscription_tiers_backup_testing_2026_03_16 AS
SELECT * FROM subscription_tiers WHERE id = 'free';

-- Verify backup
SELECT 
  id,
  name,
  limits->'max_case_budget' as max_budget,
  limits->'points_monthly' as points_monthly,
  limits->'monthly_sms_limit' as sms_limit,
  limits->'extra_points_price' as extra_points_price
FROM subscription_tiers_backup_testing_2026_03_16;
