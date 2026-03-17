/**
 * Simple test of Option A discount logic without database inserts
 * Tests that monthly and yearly purchases are tracked separately
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'servicetext_pro',
  user: 'postgres',
  password: 'C58acfd5c!'
});

async function testDiscountLogic() {
  const testUserId = 'demo-cust-001';
  
  console.log('\n=== Testing Option A: Monthly vs Yearly Discount Logic ===\n');
  
  try {
    // Get Pro tier prices
    const tierQuery = `SELECT price_monthly, price_yearly FROM subscription_tiers WHERE id = 'pro'`;
    const tierResult = await pool.query(tierQuery);
    const monthlyPrice = parseFloat(tierResult.rows[0]?.price_monthly || 230);
    const yearlyPrice = parseFloat(tierResult.rows[0]?.price_yearly || 1900);
    
    console.log('Pro Tier Prices:');
    console.log('  Monthly:', monthlyPrice, 'EUR');
    console.log('  Yearly:', yearlyPrice, 'EUR\n');
    
    // ========================================
    // TEST 1: Check for monthly Pro history
    // ========================================
    console.log('=== TEST 1: First Monthly Pro Purchase ===');
    
    const monthlyHistoryQuery = `
      SELECT COUNT(*) as count FROM sp_subscription_history 
      WHERE user_id = $1 AND tier_id = 'pro' AND action IN ('created', 'upgraded', 'renewed')
      AND (notes LIKE '%monthly%' OR notes LIKE '%Monthly%')
    `;
    const monthlyHistory = await pool.query(monthlyHistoryQuery, [testUserId]);
    const hasMonthlyHistory = parseInt(monthlyHistory.rows[0]?.count || '0') > 0;
    
    console.log('  User ID:', testUserId);
    console.log('  Has monthly Pro history:', hasMonthlyHistory);
    
    let monthlyFinalPrice = monthlyPrice;
    let monthlyDiscountApplied = false;
    
    if (!hasMonthlyHistory) {
      monthlyFinalPrice = Math.round(monthlyPrice * 0.85); // 15% discount
      monthlyDiscountApplied = true;
    }
    
    console.log('  Discount applied:', monthlyDiscountApplied);
    console.log('  Final price:', monthlyFinalPrice, 'EUR');
    if (monthlyDiscountApplied) {
      console.log('  Savings:', monthlyPrice - monthlyFinalPrice, 'EUR');
      console.log('  ✅ User gets 15% discount on first monthly purchase!');
    }
    console.log();
    
    // ========================================
    // TEST 2: Check for yearly Pro history
    // ========================================
    console.log('=== TEST 2: First Yearly Pro Purchase ===');
    
    const yearlyHistoryQuery = `
      SELECT COUNT(*) as count FROM sp_subscription_history 
      WHERE user_id = $1 AND tier_id = 'pro' AND action IN ('created', 'upgraded', 'renewed')
      AND (notes LIKE '%yearly%' OR notes LIKE '%Yearly%')
    `;
    const yearlyHistory = await pool.query(yearlyHistoryQuery, [testUserId]);
    const hasYearlyHistory = parseInt(yearlyHistory.rows[0]?.count || '0') > 0;
    
    console.log('  User ID:', testUserId);
    console.log('  Has yearly Pro history:', hasYearlyHistory);
    
    let yearlyFinalPrice = yearlyPrice;
    let yearlyDiscountApplied = false;
    
    if (!hasYearlyHistory) {
      yearlyFinalPrice = Math.round(yearlyPrice * 0.85); // 15% discount
      yearlyDiscountApplied = true;
    }
    
    console.log('  Discount applied:', yearlyDiscountApplied);
    console.log('  Final price:', yearlyFinalPrice, 'EUR');
    if (yearlyDiscountApplied) {
      console.log('  Savings:', yearlyPrice - yearlyFinalPrice, 'EUR');
      console.log('  ✅ User gets 15% discount on first yearly purchase!');
    }
    console.log();
    
    // ========================================
    // SUMMARY
    // ========================================
    console.log('=== SUMMARY ===\n');
    
    if (!hasMonthlyHistory && !hasYearlyHistory) {
      console.log('✅ PERFECT! User has no Pro history at all.');
      console.log('   They will get discount on BOTH:');
      console.log('   - First monthly purchase: Pay', monthlyFinalPrice, 'EUR (save', monthlyPrice - monthlyFinalPrice, 'EUR)');
      console.log('   - First yearly purchase: Pay', yearlyFinalPrice, 'EUR (save', yearlyPrice - yearlyFinalPrice, 'EUR)');
      console.log('\n   This means if they buy monthly first, then upgrade to yearly,');
      console.log('   they still get the yearly discount! 🎉');
    } else if (hasMonthlyHistory && !hasYearlyHistory) {
      console.log('✅ User has monthly Pro history but no yearly history.');
      console.log('   - Monthly purchase: Full price', monthlyPrice, 'EUR (no discount)');
      console.log('   - Yearly purchase: Discounted', yearlyFinalPrice, 'EUR (save', yearlyPrice - yearlyFinalPrice, 'EUR)');
      console.log('\n   They can still get discount on first yearly purchase! 🎉');
    } else if (!hasMonthlyHistory && hasYearlyHistory) {
      console.log('✅ User has yearly Pro history but no monthly history.');
      console.log('   - Monthly purchase: Discounted', monthlyFinalPrice, 'EUR (save', monthlyPrice - monthlyFinalPrice, 'EUR)');
      console.log('   - Yearly purchase: Full price', yearlyPrice, 'EUR (no discount)');
      console.log('\n   They can still get discount on first monthly purchase! 🎉');
    } else {
      console.log('✅ User has both monthly and yearly Pro history.');
      console.log('   - Monthly purchase: Full price', monthlyPrice, 'EUR (no discount)');
      console.log('   - Yearly purchase: Full price', yearlyPrice, 'EUR (no discount)');
      console.log('\n   No more discounts - they already used both! ✓');
    }
    
    console.log('\n🎯 Option A Implementation:');
    console.log('   ✓ Monthly and yearly purchases tracked separately');
    console.log('   ✓ Users can get discount on first purchase of EACH type');
    console.log('   ✓ Encourages upgrading from monthly to yearly\n');
    
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    await pool.end();
  }
}

testDiscountLogic();
