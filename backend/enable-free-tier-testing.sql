-- Enable Free Tier Testing Period
-- Date: March 16, 2026
-- Purpose: Grant all premium features to Free tier users for testing period
-- Duration: Flexible - ends when decided by admin

-- Update Free tier to have all premium features
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
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        limits,
                        '{max_case_budget}', '10000'
                      ),
                      '{points_monthly}', '1000'
                    ),
                    '{points_yearly_included}', '2000'
                  ),
                  '{monthly_sms_limit}', '50'
                ),
                '{sms_points_cost}', '0'
              ),
              '{extra_points_price}', '0.10'
            ),
            '{max_service_categories}', '999'
          ),
          '{max_gallery_photos}', '100'
        ),
        '{monthly_case_responses}', '999'
      ),
      '{premium_badge}', 'true'
    ),
    '{featured_listing}', 'true'
  ),
  '{bidding_enabled}', 'true'
)
WHERE id = 'free';

-- Verify the update
SELECT 
  id,
  name,
  limits->'max_case_budget' as max_budget,
  limits->'points_monthly' as points_monthly,
  limits->'points_yearly_included' as points_yearly,
  limits->'monthly_sms_limit' as sms_limit,
  limits->'sms_points_cost' as sms_cost,
  limits->'extra_points_price' as extra_points_price,
  limits->'max_service_categories' as max_categories,
  limits->'max_gallery_photos' as max_photos,
  limits->'monthly_case_responses' as max_responses,
  limits->'premium_badge' as premium_badge,
  limits->'featured_listing' as featured_listing,
  limits->'bidding_enabled' as bidding_enabled
FROM subscription_tiers 
WHERE id = 'free';
