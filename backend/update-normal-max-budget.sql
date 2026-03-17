-- Update Normal tier max_case_budget from 2000 to 1000 EUR
-- This will block Normal tier users from accessing cases above 1,000 EUR budget

UPDATE subscription_tiers 
SET limits = jsonb_set(limits, '{max_case_budget}', '1000')
WHERE id = 'normal';

-- Verify the update
SELECT 
  id, 
  name, 
  limits->'max_case_budget' as max_budget,
  limits->'points_cost_751_1000' as "751-1000€ cost",
  limits->'points_cost_1001_2000' as "1001-2000€ cost (should be blocked)"
FROM subscription_tiers 
WHERE id = 'normal';
