-- Add signup bonus rewards and SMS packages for existing referral (mirchev92 -> mirchev925)

-- Add 15 SMS package for referrer (mirchev92)
INSERT INTO sp_sms_packages (id, user_id, package_type, sms_count, price, currency, purchased_at, sms_used, sms_remaining, status, expires_at)
VALUES ('signup_bonus_referrer_retroactive_001', 'a2daa3b4-388c-4c13-a376-960b69f3c47c', 'signup_bonus', 15, 0, 'BGN', NOW(), 0, 15, 'active', NOW() + INTERVAL '1 year');

-- Add 15 SMS package for referee (mirchev925)
INSERT INTO sp_sms_packages (id, user_id, package_type, sms_count, price, currency, purchased_at, sms_used, sms_remaining, status, expires_at)
VALUES ('signup_bonus_referee_retroactive_001', '99d367f1-e545-4ea3-a8ee-4ea08fb79fde', 'signup_bonus', 15, 0, 'BGN', NOW(), 0, 15, 'active', NOW() + INTERVAL '1 year');

-- Add reward record for referrer (mirchev92)
INSERT INTO referral_rewards (id, referral_id, referrer_user_id, reward_type, reward_value, clicks_required, clicks_achieved, earned_at, applied_at, expires_at, status, is_aggregate)
VALUES ('reward_signup_referrer_retroactive_001', 'a39l8fet9mhi8p8wh', 'a2daa3b4-388c-4c13-a376-960b69f3c47c', 'signup_bonus_15', 15, 0, 0, NOW(), NOW(), NOW() + INTERVAL '1 year', 'applied', false);

-- Add reward record for referee (mirchev925)
INSERT INTO referral_rewards (id, referral_id, referrer_user_id, reward_type, reward_value, clicks_required, clicks_achieved, earned_at, applied_at, expires_at, status, is_aggregate)
VALUES ('reward_signup_referee_retroactive_001', 'a39l8fet9mhi8p8wh', '99d367f1-e545-4ea3-a8ee-4ea08fb79fde', 'signup_bonus_15', 15, 0, 0, NOW(), NOW(), NOW() + INTERVAL '1 year', 'applied', false);
