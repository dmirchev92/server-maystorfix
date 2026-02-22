-- REVERT SCRIPT: Run this to restore original free tier limits after Launch Mode ends
-- Original values saved on: 2026-01-21

UPDATE subscription_tiers 
SET limits = '{
  "premium_badge": false,
  "points_monthly": 15,
  "search_ranking": "standard",
  "max_case_budget": 500,
  "sms_points_cost": 2,
  "analytics_access": false,
  "featured_listing": false,
  "max_certificates": 2,
  "priority_support": false,
  "monthly_sms_limit": 0,
  "points_cost_1_250": 0,
  "extra_points_price": null,
  "max_gallery_photos": 5,
  "points_cost_250_500": 0,
  "points_cost_500_750": 0,
  "points_cost_750_1000": 0,
  "points_cost_1000_1500": 0,
  "points_cost_1500_2000": 0,
  "points_cost_2000_3000": 0,
  "points_cost_3000_4000": 0,
  "points_cost_4000_5000": 0,
  "points_cost_5000_7500": 0,
  "max_service_categories": 2,
  "monthly_case_responses": 10,
  "points_cost_7500_10000": 0,
  "points_yearly_included": 0
}'::jsonb
WHERE id = 'free';

-- Also set LAUNCH_MODE=false in backend/.env
