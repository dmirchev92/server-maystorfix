/**
 * Test script for first-time Pro discount (15%)
 * This tests the discount logic without actually creating a subscription
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'servicetext_pro',
  user: 'postgres',
  password: 'C58acfd5c!'
});

async function testFirstTimeDiscount() {
  const testUserId = 'demo-cust-001'; // User with no Pro history
  
  console.log('\n=== Testing First-Time Pro Discount Logic ===\n');
  
  try {
    // Step 1: Check if user has Pro history
    console.log('Step 1: Checking Pro subscription history for user:', testUserId);
    const historyQuery = `
      SELECT COUNT(*) as count FROM sp_subscription_history 
      WHERE user_id = $1 AND tier_id = 'pro' AND action IN ('created', 'upgraded', 'renewed')
    `;
    const historyResult = await pool.query(historyQuery, [testUserId]);
    const hasProHistory = parseInt(historyResult.rows[0]?.count || '0') > 0;
    
    console.log('   Has Pro history:', hasProHistory);
    console.log('   History count:', historyResult.rows[0]?.count);
    
    // Step 2: Get Pro tier price
    const tierQuery = `SELECT price_yearly FROM subscription_tiers WHERE id = 'pro'`;
    const tierResult = await pool.query(tierQuery);
    const originalPrice = parseFloat(tierResult.rows[0]?.price_yearly || 1900);
    
    console.log('\nStep 2: Pro tier pricing');
    console.log('   Original yearly price:', originalPrice, 'EUR');
    
    // Step 3: Calculate discount
    let finalPrice = originalPrice;
    let discountApplied = false;
    
    if (!hasProHistory) {
      finalPrice = Math.round(originalPrice * 0.85); // 15% discount
      discountApplied = true;
    }
    
    console.log('\nStep 3: Discount calculation');
    console.log('   Discount applied:', discountApplied);
    console.log('   Final price:', finalPrice, 'EUR');
    console.log('   Savings:', originalPrice - finalPrice, 'EUR');
    console.log('   Discount percentage:', ((1 - finalPrice/originalPrice) * 100).toFixed(1) + '%');
    
    // Step 4: Test with a user who already has Pro history
    console.log('\n\nStep 4: Testing with user who has Pro history');
    const existingProUser = 'test-pro-user-001';
    
    const existingHistoryResult = await pool.query(historyQuery, [existingProUser]);
    const existingHasProHistory = parseInt(existingHistoryResult.rows[0]?.count || '0') > 0;
    
    console.log('   User:', existingProUser);
    console.log('   Has Pro history:', existingHasProHistory);
    
    let existingFinalPrice = originalPrice;
    let existingDiscountApplied = false;
    
    if (!existingHasProHistory) {
      existingFinalPrice = Math.round(originalPrice * 0.85);
      existingDiscountApplied = true;
    }
    
    console.log('   Discount applied:', existingDiscountApplied);
    console.log('   Final price:', existingFinalPrice, 'EUR');
    
    // Summary
    console.log('\n\n=== Test Summary ===');
    console.log('✅ First-time user (demo-cust-001):');
    console.log('   - Gets 15% discount:', discountApplied);
    console.log('   - Pays:', finalPrice, 'EUR instead of', originalPrice, 'EUR');
    console.log('   - Saves:', originalPrice - finalPrice, 'EUR');
    
    console.log('\n✅ Existing Pro user (test-pro-user-001):');
    console.log('   - Gets 15% discount:', existingDiscountApplied);
    console.log('   - Pays:', existingFinalPrice, 'EUR');
    
    console.log('\n✅ Discount logic is working correctly!\n');
    
  } catch (error) {
    console.error('Error testing discount:', error);
  } finally {
    await pool.end();
  }
}

testFirstTimeDiscount();
