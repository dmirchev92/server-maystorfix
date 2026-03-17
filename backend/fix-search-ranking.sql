-- Fix search_ranking for Free tier to 'enhanced' instead of 'standard'
UPDATE subscription_tiers 
SET limits = jsonb_set(limits, '{search_ranking}', '"enhanced"')
WHERE id = 'free';

-- Verify the update
SELECT 
  id,
  name,
  limits->'search_ranking' as search_ranking,
  limits->'premium_badge' as premium_badge,
  limits->'featured_listing' as featured_listing
FROM subscription_tiers 
WHERE id = 'free';
