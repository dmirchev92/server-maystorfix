-- Fix missing electrician categories in provider_service_categories table
-- Issue: Providers have cat_electrician as primary_category but it's missing from provider_service_categories

-- Add cat_electrician to Danail Mirchev (7d700e28-dc86-4ab7-8774-d80fc391445b)
INSERT INTO provider_service_categories (id, provider_id, category_id, created_at)
VALUES (gen_random_uuid()::text, '7d700e28-dc86-4ab7-8774-d80fc391445b', 'cat_electrician', NOW())
ON CONFLICT (provider_id, category_id) DO NOTHING;

-- Add cat_electrician to Test F (84b6f873-67dc-4f5a-b2f0-cfb12e30f463)
INSERT INTO provider_service_categories (id, provider_id, category_id, created_at)
VALUES (gen_random_uuid()::text, '84b6f873-67dc-4f5a-b2f0-cfb12e30f463', 'cat_electrician', NOW())
ON CONFLICT (provider_id, category_id) DO NOTHING;

-- Verify the fix
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  spp.business_name,
  spp.service_category as primary_category,
  ARRAY_AGG(DISTINCT psc.category_id) as all_categories
FROM users u
JOIN service_provider_profiles spp ON u.id = spp.user_id
LEFT JOIN provider_service_categories psc ON u.id = psc.provider_id
WHERE spp.service_category = 'cat_electrician'
GROUP BY u.id, u.first_name, u.last_name, spp.business_name, spp.service_category
ORDER BY spp.business_name;
