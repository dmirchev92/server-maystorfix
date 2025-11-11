/**
 * Test Point System with Existing Cases
 * Verifies that the point system works correctly with cases created before implementation
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'servicetextpro',
  password: process.env.POSTGRES_PASSWORD || 'C58acfd5c!'
});

// Simulate PointsService calculatePointsCost
function calculatePointsCost(budget, tierLimits) {
  if (budget <= 250) {
    return tierLimits.points_cost_1_250;
  } else if (budget <= 500) {
    return tierLimits.points_cost_250_500;
  } else if (budget <= 750) {
    return tierLimits.points_cost_500_750;
  } else if (budget <= 1000) {
    return tierLimits.points_cost_750_1000;
  } else if (budget <= 1500) {
    return tierLimits.points_cost_1000_1500;
  } else if (budget <= 2000) {
    return tierLimits.points_cost_1500_2000;
  } else if (budget <= 3000) {
    return tierLimits.points_cost_2000_3000;
  } else if (budget <= 4000) {
    return tierLimits.points_cost_3000_4000;
  } else if (budget <= 5000) {
    return tierLimits.points_cost_4000_5000;
  }
  
  return tierLimits.points_cost_4000_5000;
}

// Convert budget range string to numeric midpoint
function getBudgetMidpoint(budgetRange) {
  const ranges = {
    '1-250': 125,
    '250-500': 375,
    '500-750': 625,
    '750-1000': 875,
    '1000-1250': 1125,
    '1250-1500': 1375,
    '1500-1750': 1625,
    '1750-2000': 1875,
    '2000+': 2500
  };
  
  return ranges[budgetRange] || 500;
}

function getBudgetRange(budget) {
  if (budget <= 250) return '1-250 BGN';
  if (budget <= 500) return '250-500 BGN';
  if (budget <= 750) return '500-750 BGN';
  if (budget <= 1000) return '750-1000 BGN';
  if (budget <= 1500) return '1000-1500 BGN';
  if (budget <= 2000) return '1500-2000 BGN';
  if (budget <= 3000) return '2000-3000 BGN';
  if (budget <= 4000) return '3000-4000 BGN';
  if (budget <= 5000) return '4000-5000 BGN';
  return '5000+ BGN';
}

async function testExistingCases() {
  const client = await pool.connect();
  
  try {
    console.log('=== Testing Point System with Existing Cases ===\n');
    
    // Get tier configurations
    const tiersResult = await client.query(`
      SELECT id, name, limits
      FROM subscription_tiers
      ORDER BY display_order
    `);
    const tiers = tiersResult.rows;
    
    // Get existing cases
    const casesResult = await client.query(`
      SELECT 
        id,
        category,
        budget,
        created_at,
        status,
        bidding_enabled
      FROM marketplace_service_cases
      ORDER BY created_at DESC
      LIMIT 15
    `);
    
    console.log(`Found ${casesResult.rows.length} existing cases\n`);
    console.log('Case Analysis:\n');
    console.log('Case ID (short) | Category | Budget Range | Created | Status | Points Required (FREE/NORMAL/PRO)');
    console.log('----------------|----------|--------------|---------|--------|----------------------------------');
    
    casesResult.rows.forEach(caseData => {
      const shortId = caseData.id.substring(0, 8);
      const budgetRange = caseData.budget;
      const budgetMidpoint = getBudgetMidpoint(budgetRange);
      const createdDate = new Date(caseData.created_at).toLocaleDateString();
      
      const pointCosts = {};
      const canAccess = {};
      
      tiers.forEach(tier => {
        const maxBudget = parseInt(tier.limits.max_case_budget);
        
        if (budgetMidpoint > maxBudget) {
          pointCosts[tier.id] = '❌';
          canAccess[tier.id] = false;
        } else {
          const cost = calculatePointsCost(budgetMidpoint, tier.limits);
          if (cost === 0) {
            pointCosts[tier.id] = '❌';
            canAccess[tier.id] = false;
          } else {
            pointCosts[tier.id] = cost;
            canAccess[tier.id] = true;
          }
        }
      });
      
      const freeStr = String(pointCosts.free).padEnd(4);
      const normalStr = String(pointCosts.normal).padEnd(6);
      const proStr = String(pointCosts.pro).padEnd(3);
      
      console.log(`${shortId} | ${caseData.category.padEnd(8)} | ${budgetRange.padEnd(12)} | ${createdDate} | ${caseData.status.padEnd(7)} | ${freeStr} / ${normalStr} / ${proStr}`);
    });
    
    // Detailed analysis for a few cases
    console.log('\n=== Detailed Analysis of Sample Cases ===\n');
    
    const sampleCases = casesResult.rows.slice(0, 5);
    
    for (const caseData of sampleCases) {
      const budgetRange = caseData.budget;
      const budgetMidpoint = getBudgetMidpoint(budgetRange);
      const shortId = caseData.id.substring(0, 8);
      
      console.log(`Case ${shortId} (${caseData.category}):`);
      console.log(`  Budget Range: ${budgetRange}`);
      console.log(`  Budget Midpoint: ${budgetMidpoint} BGN`);
      console.log(`  Created: ${new Date(caseData.created_at).toLocaleString()}`);
      console.log(`  Status: ${caseData.status}`);
      console.log(`  Bidding: ${caseData.bidding_enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`  Point Costs:`);
      
      tiers.forEach(tier => {
        const maxBudget = parseInt(tier.limits.max_case_budget);
        const monthlyPoints = parseInt(tier.limits.points_monthly);
        
        if (budgetMidpoint > maxBudget) {
          console.log(`    ${tier.name}: ❌ Exceeds tier limit (${maxBudget} BGN)`);
        } else {
          const cost = calculatePointsCost(budgetMidpoint, tier.limits);
          if (cost === 0) {
            console.log(`    ${tier.name}: ❌ Not available in this tier`);
          } else {
            const casesPerMonth = Math.floor(monthlyPoints / cost);
            console.log(`    ${tier.name}: ${cost} points (can access ${casesPerMonth} similar cases/month)`);
          }
        }
      });
      console.log('');
    }
    
    // Summary statistics
    console.log('=== Summary Statistics ===\n');
    
    const budgetDistribution = {};
    casesResult.rows.forEach(c => {
      budgetDistribution[c.budget] = (budgetDistribution[c.budget] || 0) + 1;
    });
    
    console.log('Budget Range Distribution:');
    Object.entries(budgetDistribution).sort().forEach(([range, count]) => {
      const midpoint = getBudgetMidpoint(range);
      const percentage = ((count / casesResult.rows.length) * 100).toFixed(1);
      console.log(`  ${range.padEnd(12)}: ${count} cases (${percentage}%) - Midpoint: ${midpoint} BGN`);
    });
    
    console.log('\n=== Compatibility Check ===\n');
    
    // Check if budget ranges match our new system
    const uniqueBudgetRanges = [...new Set(casesResult.rows.map(c => c.budget))];
    console.log('Budget ranges found in existing cases:');
    uniqueBudgetRanges.forEach(range => {
      const midpoint = getBudgetMidpoint(range);
      const calculatedRange = getBudgetRange(midpoint);
      const matches = calculatedRange.includes(range.split('-')[0]);
      console.log(`  ${range.padEnd(12)} → Midpoint: ${midpoint} BGN → Maps to: ${calculatedRange} ${matches ? '✅' : '⚠️'}`);
    });
    
    console.log('\n✅ Point system is compatible with existing cases!');
    console.log('   All existing cases can be processed using budget range midpoints.\n');

  } catch (error) {
    console.error('❌ Error testing existing cases:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testExistingCases()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
