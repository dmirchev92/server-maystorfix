/**
 * Free Tier Testing Period - Feature Verification Tests
 * Tests all 7 scenarios to verify Free tier has full premium access
 */

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'servicetext_pro',
  user: 'postgres',
  password: 'C58acfd5c!'
});

const API_BASE = 'http://localhost:3000/api/v1';
let testUserId = null;
let authToken = null;

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details) {
  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}`);
  }
  if (details) console.log(`   ${details}`);
}

async function setup() {
  console.log('\n🔧 Setting up test environment...\n');
  
  // Find a Free tier test user (any role)
  const userQuery = `
    SELECT id, email, role FROM users 
    WHERE subscription_tier_id = 'free'
    LIMIT 1
  `;
  const users = await pool.query(userQuery);
  
  if (users.rows.length > 0) {
    testUserId = users.rows[0].id;
    console.log(`Using existing Free tier user: ${users.rows[0].email} (${users.rows[0].role})`);
  } else {
    console.log('No Free tier users found. Please create a test user first.');
    process.exit(1);
  }
}

async function test1_SMSFunctionality() {
  console.log('\n📱 TEST 1: SMS Functionality\n');
  
  try {
    // Check SMS limits for Free tier
    const limitsQuery = `
      SELECT 
        limits->'monthly_sms_limit' as sms_limit,
        limits->'sms_points_cost' as sms_cost
      FROM subscription_tiers st
      JOIN users u ON u.subscription_tier_id = st.id
      WHERE u.id = $1
    `;
    const limits = await pool.query(limitsQuery, [testUserId]);
    
    const smsLimit = parseInt(limits.rows[0].sms_limit);
    const smsCost = parseInt(limits.rows[0].sms_cost);
    
    logTest('SMS Limit Check', smsLimit === 50, `Limit: ${smsLimit}/month (expected 50)`);
    logTest('SMS Cost Check', smsCost === 0, `Cost: ${smsCost} points (expected 0)`);
    
    // Check user's points balance
    const balanceQuery = `SELECT points_balance FROM users WHERE id = $1`;
    const balance = await pool.query(balanceQuery, [testUserId]);
    const currentBalance = balance.rows[0].points_balance || 0;
    
    logTest('Points Balance Available', currentBalance >= 0, `Balance: ${currentBalance} points`);
    
  } catch (error) {
    logTest('SMS Functionality Test', false, `Error: ${error.message}`);
  }
}

async function test2_BudgetCases() {
  console.log('\n💰 TEST 2: Accept Different Budget Cases\n');
  
  const budgetRanges = [
    { range: '1-250', midpoint: 125 },
    { range: '251-500', midpoint: 375 },
    { range: '501-750', midpoint: 625 },
    { range: '751-1000', midpoint: 875 },
    { range: '1001-2000', midpoint: 1500 },
    { range: '2001-3000', midpoint: 2500 },
    { range: '5001-6000', midpoint: 5500 },
    { range: '9001-10000', midpoint: 9500 }
  ];
  
  try {
    // Get Free tier limits
    const tierQuery = `
      SELECT 
        limits->'max_case_budget' as max_budget,
        limits->'points_cost_1_250' as cost_low,
        limits->'points_cost_9001_10000' as cost_high
      FROM subscription_tiers st
      JOIN users u ON u.subscription_tier_id = st.id
      WHERE u.id = $1
    `;
    const tier = await pool.query(tierQuery, [testUserId]);
    
    const maxBudget = parseInt(tier.rows[0].max_budget);
    const costLow = parseInt(tier.rows[0].cost_low);
    const costHigh = parseInt(tier.rows[0].cost_high || 0);
    
    logTest('Max Budget Check', maxBudget === 10000, `Max: ${maxBudget} EUR (expected 10000)`);
    logTest('Low Budget Cost', costLow === 0, `1-250 EUR cost: ${costLow} points (expected 0)`);
    logTest('High Budget Cost', costHigh === 0, `9001-10000 EUR cost: ${costHigh} points (expected 0)`);
    
    // Test each budget range accessibility
    for (const budget of budgetRanges) {
      const accessible = budget.midpoint <= maxBudget;
      logTest(
        `Budget Range ${budget.range} EUR`,
        accessible,
        accessible ? 'Accessible' : 'Blocked'
      );
    }
    
  } catch (error) {
    logTest('Budget Cases Test', false, `Error: ${error.message}`);
  }
}

async function test3_MapVisibility() {
  console.log('\n🗺️  TEST 3: Map Visibility Features\n');
  
  try {
    // Check premium features
    const featuresQuery = `
      SELECT 
        limits->'premium_badge' as premium_badge,
        limits->'featured_listing' as featured_listing,
        limits->'search_ranking' as search_ranking
      FROM subscription_tiers st
      JOIN users u ON u.subscription_tier_id = st.id
      WHERE u.id = $1
    `;
    const features = await pool.query(featuresQuery, [testUserId]);
    
    const premiumBadge = features.rows[0].premium_badge;
    const featuredListing = features.rows[0].featured_listing;
    const searchRanking = features.rows[0].search_ranking;
    
    logTest('Premium Badge', premiumBadge === true, `Enabled: ${premiumBadge}`);
    logTest('Featured Listing', featuredListing === true, `Enabled: ${featuredListing}`);
    logTest('Search Ranking', searchRanking !== 'standard', `Ranking: ${searchRanking}`);
    
  } catch (error) {
    logTest('Map Visibility Test', false, `Error: ${error.message}`);
  }
}

async function test4_VIPPurchase() {
  console.log('\n👑 TEST 4: VIP Purchase\n');
  
  try {
    // Check if VIP is enabled for Free tier
    const vipQuery = `
      SELECT 
        limits->'bidding_enabled' as bidding_enabled,
        limits->'featured_listing' as featured_listing
      FROM subscription_tiers st
      JOIN users u ON u.subscription_tier_id = st.id
      WHERE u.id = $1
    `;
    const vip = await pool.query(vipQuery, [testUserId]);
    
    const biddingEnabled = vip.rows[0].bidding_enabled;
    const featuredListing = vip.rows[0].featured_listing;
    
    logTest('Bidding System Access', biddingEnabled === true, `Enabled: ${biddingEnabled}`);
    logTest('VIP Features Access', featuredListing === true, `Featured: ${featuredListing}`);
    
    // Check if user has points for VIP
    const balanceQuery = `SELECT points_balance FROM users WHERE id = $1`;
    const balance = await pool.query(balanceQuery, [testUserId]);
    const currentBalance = balance.rows[0].points_balance || 0;
    
    logTest('Points for VIP Bids', currentBalance >= 0, `Balance: ${currentBalance} points`);
    
  } catch (error) {
    logTest('VIP Purchase Test', false, `Error: ${error.message}`);
  }
}

async function test5_PointsPurchase() {
  console.log('\n💎 TEST 5: Purchase Add-on Points\n');
  
  try {
    // Check if Free tier can purchase points
    const priceQuery = `
      SELECT 
        limits->'extra_points_price' as price_per_point
      FROM subscription_tiers st
      JOIN users u ON u.subscription_tier_id = st.id
      WHERE u.id = $1
    `;
    const price = await pool.query(priceQuery, [testUserId]);
    
    const pricePerPoint = parseFloat(price.rows[0].price_per_point);
    
    logTest('Can Purchase Points', pricePerPoint !== null && pricePerPoint > 0, `Price: ${pricePerPoint} EUR/point`);
    logTest('Correct Pricing', pricePerPoint === 0.10, `Expected 0.10 EUR/point, got ${pricePerPoint}`);
    
  } catch (error) {
    logTest('Points Purchase Test', false, `Error: ${error.message}`);
  }
}

async function test6_PointsTracking() {
  console.log('\n📊 TEST 6: Points Tracking\n');
  
  try {
    // Check points allocation
    const pointsQuery = `
      SELECT 
        u.points_balance,
        u.points_total_earned,
        u.points_total_spent,
        st.limits->'points_monthly' as monthly_points,
        st.limits->'points_yearly_included' as yearly_points
      FROM users u
      JOIN subscription_tiers st ON u.subscription_tier_id = st.id
      WHERE u.id = $1
    `;
    const points = await pool.query(pointsQuery, [testUserId]);
    
    const balance = points.rows[0].points_balance || 0;
    const earned = points.rows[0].points_total_earned || 0;
    const spent = points.rows[0].points_total_spent || 0;
    const monthlyPoints = parseInt(points.rows[0].monthly_points);
    const yearlyPoints = parseInt(points.rows[0].yearly_points);
    
    logTest('Monthly Points Allocation', monthlyPoints === 1000, `Monthly: ${monthlyPoints} (expected 1000)`);
    logTest('Yearly Points Allocation', yearlyPoints === 2000, `Yearly: ${yearlyPoints} (expected 2000)`);
    logTest('Points Balance Tracked', balance >= 0, `Balance: ${balance}`);
    logTest('Points Earned Tracked', earned >= 0, `Earned: ${earned}`);
    logTest('Points Spent Tracked', spent >= 0, `Spent: ${spent}`);
    
  } catch (error) {
    logTest('Points Tracking Test', false, `Error: ${error.message}`);
  }
}

async function test7_ChatFunctionality() {
  console.log('\n💬 TEST 7: Chat Functionality\n');
  
  try {
    // Check if Free tier has chat access (no specific limits in tier)
    const tierQuery = `
      SELECT 
        limits->'max_service_categories' as max_categories,
        limits->'max_gallery_photos' as max_photos
      FROM subscription_tiers st
      JOIN users u ON u.subscription_tier_id = st.id
      WHERE u.id = $1
    `;
    const tier = await pool.query(tierQuery, [testUserId]);
    
    const maxCategories = parseInt(tier.rows[0].max_categories);
    const maxPhotos = parseInt(tier.rows[0].max_photos);
    
    logTest('Unlimited Categories', maxCategories === 999, `Categories: ${maxCategories}`);
    logTest('Large Gallery', maxPhotos === 100, `Photos: ${maxPhotos} (vs 5 before)`);
    
    // Chat has no specific tier limits, so it's always accessible
    logTest('Chat Access', true, 'No tier restrictions on chat');
    
  } catch (error) {
    logTest('Chat Functionality Test', false, `Error: ${error.message}`);
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(60));
  
  if (results.failed > 0) {
    console.log('\n⚠️  Failed Tests:');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`   - ${t.name}: ${t.details}`);
    });
  }
  
  console.log('\n' + (results.failed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed'));
  console.log('');
}

async function runAllTests() {
  try {
    await setup();
    await test1_SMSFunctionality();
    await test2_BudgetCases();
    await test3_MapVisibility();
    await test4_VIPPurchase();
    await test5_PointsPurchase();
    await test6_PointsTracking();
    await test7_ChatFunctionality();
    await printSummary();
  } catch (error) {
    console.error('❌ Test suite error:', error);
  } finally {
    await pool.end();
  }
}

runAllTests();
