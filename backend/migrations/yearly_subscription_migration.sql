-- Migration: Yearly Subscription Model with Points System
-- Date: 2024-12-13
-- Description: Adds yearly pricing, updates points costs, SMS points cost per tier

-- 1. Add price_yearly column
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS price_yearly numeric DEFAULT 0;

-- 2. Update FREE tier
UPDATE subscription_tiers 
SET 
  price_yearly = 0,
  limits = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(limits, '{points_yearly_included}', '0'),
                            '{sms_points_cost}', '2'
                          ),
                          '{extra_points_price}', 'null'
                        ),
                        '{points_cost_1_250}', '0'
                      ),
                      '{points_cost_250_500}', '0'
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
      ),
      '{points_cost_5000_7500}', '0'
    ),
    '{points_cost_7500_10000}', '0'
  )
WHERE id = 'free';

-- 3. Update NORMAL tier (349 BGN/year, 350 points, max 1500 BGN cases)
UPDATE subscription_tiers 
SET 
  price_yearly = 349,
  limits = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(
                              jsonb_set(limits, '{points_yearly_included}', '350'),
                              '{sms_points_cost}', '2'
                            ),
                            '{extra_points_price}', '0.30'
                          ),
                          '{max_case_budget}', '1500'
                        ),
                        '{points_cost_1_250}', '19'
                      ),
                      '{points_cost_250_500}', '33'
                    ),
                    '{points_cost_500_750}', '42'
                  ),
                  '{points_cost_750_1000}', '50'
                ),
                '{points_cost_1000_1500}', '60'
              ),
              '{points_cost_1500_2000}', '0'
            ),
            '{points_cost_2000_3000}', '0'
          ),
          '{points_cost_3000_4000}', '0'
        ),
        '{points_cost_4000_5000}', '0'
      ),
      '{points_cost_5000_7500}', '0'
    ),
    '{points_cost_7500_10000}', '0'
  )
WHERE id = 'normal';

-- 4. Update PRO tier (489 BGN/year, 500 points, all budgets)
UPDATE subscription_tiers 
SET 
  price_yearly = 489,
  limits = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(
                              jsonb_set(limits, '{points_yearly_included}', '500'),
                              '{sms_points_cost}', '1'
                            ),
                            '{extra_points_price}', '0.25'
                          ),
                          '{max_case_budget}', '999999'
                        ),
                        '{points_cost_1_250}', '17'
                      ),
                      '{points_cost_250_500}', '29'
                    ),
                    '{points_cost_500_750}', '38'
                  ),
                  '{points_cost_750_1000}', '45'
                ),
                '{points_cost_1000_1500}', '54'
              ),
              '{points_cost_1500_2000}', '64'
            ),
            '{points_cost_2000_3000}', '76'
          ),
          '{points_cost_3000_4000}', '90'
        ),
        '{points_cost_4000_5000}', '102'
      ),
      '{points_cost_5000_7500}', '120'
    ),
    '{points_cost_7500_10000}', '142'
  )
WHERE id = 'pro';

-- 5. Verify the migration
SELECT id, name, price_monthly, price_yearly, 
       limits->>'points_yearly_included' as points_yearly,
       limits->>'sms_points_cost' as sms_cost,
       limits->>'extra_points_price' as topup_price,
       limits->>'max_case_budget' as max_budget,
       limits->>'points_cost_1_250' as cost_1_250,
       limits->>'points_cost_1000_1500' as cost_1000_1500
FROM subscription_tiers 
ORDER BY display_order;
