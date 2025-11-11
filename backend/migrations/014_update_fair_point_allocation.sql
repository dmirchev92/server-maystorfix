-- ============================================================================
-- Migration: Update Fair Point Allocation System
-- Description: Implements granular budget ranges with fair point costs
-- Based on recommended structure for balanced tier value
-- ============================================================================

-- ============================================================================
-- 1. UPDATE FREE TIER (40 points/month, max 500 BGN)
-- ============================================================================
-- FREE tier gets access to small cases (1-500 BGN)
-- Can access 6-7 small cases (1-250 BGN) OR 4 medium-small cases (250-500 BGN)

UPDATE subscription_tiers 
SET limits = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  limits,
                  '{points_cost_1_250}', '6'
                ),
                '{points_cost_250_500}', '10'
              ),
              '{points_cost_500_750}', '0'
            ),
            '{points_cost_750_1000}', '0'
          ),
          '{points_cost_1000_1500}', '0'
        ),
        '{points_cost_1500_2000}', '0'
      ),
      '{points_cost_2000_3000}', '0'
    ),
    '{points_cost_3000_4000}', '0'
  ),
  '{points_cost_4000_5000}', '0'
)
WHERE id = 'free';

-- ============================================================================
-- 2. UPDATE NORMAL TIER (150 points/month, max 1500 BGN)
-- ============================================================================
-- NORMAL tier gets access to cases up to 1500 BGN
-- Can access 37 small cases OR 21 medium cases OR 6 large cases

UPDATE subscription_tiers 
SET limits = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  limits,
                  '{points_cost_1_250}', '4'
                ),
                '{points_cost_250_500}', '7'
              ),
              '{points_cost_500_750}', '12'
            ),
            '{points_cost_750_1000}', '18'
          ),
          '{points_cost_1000_1500}', '25'
        ),
        '{points_cost_1500_2000}', '0'
      ),
      '{points_cost_2000_3000}', '0'
    ),
    '{points_cost_3000_4000}', '0'
  ),
  '{points_cost_4000_5000}', '0'
)
WHERE id = 'normal';

-- ============================================================================
-- 3. UPDATE PRO TIER (250 points/month, unlimited budget)
-- ============================================================================
-- PRO tier gets full access to all budget ranges with discounted rates
-- Can access 83 small cases OR 31 medium cases OR 13 large cases OR 4-5 premium cases

UPDATE subscription_tiers 
SET limits = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  limits,
                  '{points_cost_1_250}', '3'
                ),
                '{points_cost_250_500}', '5'
              ),
              '{points_cost_500_750}', '8'
            ),
            '{points_cost_750_1000}', '12'
          ),
          '{points_cost_1000_1500}', '18'
        ),
        '{points_cost_1500_2000}', '25'
      ),
      '{points_cost_2000_3000}', '35'
    ),
    '{points_cost_3000_4000}', '45'
  ),
  '{points_cost_4000_5000}', '55'
)
WHERE id = 'pro';

-- ============================================================================
-- 4. REMOVE OLD POINT COST FIELDS (if they exist)
-- ============================================================================
-- Clean up old point cost fields that are no longer used

UPDATE subscription_tiers 
SET limits = limits - 'points_cost_1_500' - 'points_cost_500_1000'
WHERE limits ? 'points_cost_1_500' OR limits ? 'points_cost_500_1000';

-- ============================================================================
-- 5. VERIFICATION QUERY
-- ============================================================================
-- Run this to verify the changes:
-- SELECT id, name, 
--   limits->>'points_monthly' as monthly_points,
--   limits->>'max_case_budget' as max_budget,
--   limits->>'points_cost_1_250' as cost_1_250,
--   limits->>'points_cost_250_500' as cost_250_500,
--   limits->>'points_cost_500_750' as cost_500_750,
--   limits->>'points_cost_750_1000' as cost_750_1000,
--   limits->>'points_cost_1000_1500' as cost_1000_1500,
--   limits->>'points_cost_1500_2000' as cost_1500_2000,
--   limits->>'points_cost_2000_3000' as cost_2000_3000,
--   limits->>'points_cost_3000_4000' as cost_3000_4000,
--   limits->>'points_cost_4000_5000' as cost_4000_5000
-- FROM subscription_tiers
-- ORDER BY display_order;
