-- Update Normal tier yearly pricing from 1,100 to 1,400 EUR
UPDATE subscription_tiers 
SET price_yearly = 1400 
WHERE id = 'normal';

-- Verify the update
SELECT id, name, price_monthly, price_yearly 
FROM subscription_tiers 
WHERE id = 'normal';
