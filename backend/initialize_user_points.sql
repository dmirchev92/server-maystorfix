-- Initialize points for all existing tradesperson users
-- This ensures everyone has their monthly points allocation

-- First, ensure all tradesperson users have a tier assigned (default to free)
UPDATE users 
SET subscription_tier_id = 'free'
WHERE role = 'tradesperson' AND subscription_tier_id IS NULL;

-- Now update points for all tradesperson users based on their tier
UPDATE users u
SET 
    points_balance = (
        SELECT (st.limits->>'points_monthly')::INTEGER
        FROM subscription_tiers st
        WHERE st.id = u.subscription_tier_id
    ),
    points_total_earned = (
        SELECT (st.limits->>'points_monthly')::INTEGER
        FROM subscription_tiers st
        WHERE st.id = u.subscription_tier_id
    ),
    points_total_spent = 0,
    points_last_reset = CURRENT_TIMESTAMP
WHERE role = 'tradesperson';

-- Show summary of points assigned
SELECT 
    u.subscription_tier_id as tier,
    COUNT(*) as user_count,
    u.points_balance as points_assigned,
    st.limits->>'max_case_budget' as max_budget
FROM users u
JOIN subscription_tiers st ON st.id = u.subscription_tier_id
WHERE u.role = 'tradesperson'
GROUP BY u.subscription_tier_id, u.points_balance, st.limits
ORDER BY u.subscription_tier_id;
