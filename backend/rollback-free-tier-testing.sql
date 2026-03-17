-- Rollback Free tier to original restricted state
-- Run this after testing period ends
-- Date: To be executed when testing period ends

-- Restore Free tier to original limits (from backup taken March 16, 2026)
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
                        '{max_case_budget}', '250'
                      ),
                      '{points_monthly}', '15'
                    ),
                    '{points_yearly_included}', '0'
                  ),
                  '{monthly_sms_limit}', '0'
                ),
                '{sms_points_cost}', 'null'
              ),
              '{extra_points_price}', 'null'
            ),
            '{max_service_categories}', '2'
          ),
          '{max_gallery_photos}', '5'
        ),
        '{monthly_case_responses}', '5'
      ),
      '{premium_badge}', 'false'
    ),
    '{featured_listing}', 'false'
  ),
  '{bidding_enabled}', 'null'
)
WHERE id = 'free';

-- Verify rollback
SELECT 
  id,
  name,
  limits->'max_case_budget' as max_budget,
  limits->'points_monthly' as points_monthly,
  limits->'monthly_sms_limit' as sms_limit,
  limits->'extra_points_price' as extra_points_price,
  limits->'max_service_categories' as max_categories,
  limits->'max_gallery_photos' as max_photos,
  limits->'premium_badge' as premium_badge,
  limits->'featured_listing' as featured_listing
FROM subscription_tiers 
WHERE id = 'free';

-- Optional: Notify users about tier changes
-- You can add notification logic here when ready to rollback
