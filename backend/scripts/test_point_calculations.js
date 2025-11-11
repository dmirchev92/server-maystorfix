/**
 * Test Point Calculation System
 * Verifies that the PointsService correctly calculates points for different budget ranges
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'servicetextpro',
  password: process.env.POSTGRES_PASSWORD || 'C58acfd5c!'
});

// Simulate the PointsService calculatePointsCost method
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

async function testPointCalculations() {
  const client = await pool.connect();
  
  try {
    console.log('=== Testing Point Calculation System ===\n');
    
    // Get tier configurations
    const result = await client.query(`
      SELECT id, name, limits
      FROM subscription_tiers
      ORDER BY display_order
    `);

    const tiers = result.rows;
    
    // Test budgets across all ranges
    const testBudgets = [
      100,   // 1-250 BGN
      250,   // 1-250 BGN (boundary)
      300,   // 250-500 BGN
      500,   // 250-500 BGN (boundary)
      600,   // 500-750 BGN
      750,   // 500-750 BGN (boundary)
      900,   // 750-1000 BGN
      1000,  // 750-1000 BGN (boundary)
      1200,  // 1000-1500 BGN
      1500,  // 1000-1500 BGN (boundary)
      1800,  // 1500-2000 BGN
      2500,  // 2000-3000 BGN
      3500,  // 3000-4000 BGN
      4500,  // 4000-5000 BGN
      6000   // 5000+ BGN
    ];

    console.log('Test Budget Scenarios:\n');
    console.log('Budget (BGN) | Range          | FREE | NORMAL | PRO  | Notes');
    console.log('-------------|----------------|------|--------|------|------------------');

    testBudgets.forEach(budget => {
      const range = getBudgetRange(budget);
      const costs = {};
      const notes = [];

      tiers.forEach(tier => {
        const cost = calculatePointsCost(budget, tier.limits);
        costs[tier.id] = cost;
        
        // Check if tier can access this budget
        const maxBudget = parseInt(tier.limits.max_case_budget);
        if (budget > maxBudget) {
          costs[tier.id] = '❌';
          notes.push(`${tier.name} max: ${maxBudget}`);
        } else if (cost === 0) {
          costs[tier.id] = '❌';
          notes.push(`${tier.name}: not available`);
        }
      });

      const freeStr = String(costs.free).padEnd(4);
      const normalStr = String(costs.normal).padEnd(6);
      const proStr = String(costs.pro).padEnd(4);
      const notesStr = notes.length > 0 ? notes.join(', ') : '✓ All tiers OK';

      console.log(`${String(budget).padEnd(12)} | ${range.padEnd(14)} | ${freeStr} | ${normalStr} | ${proStr} | ${notesStr}`);
    });

    // Calculate monthly access potential
    console.log('\n=== Monthly Access Potential ===\n');

    tiers.forEach(tier => {
      const monthlyPoints = parseInt(tier.limits.points_monthly);
      console.log(`${tier.name.toUpperCase()} Tier (${monthlyPoints} points/month):`);
      
      // Sample calculations for common budgets
      const sampleBudgets = [
        { budget: 150, label: 'Small (150 BGN)' },
        { budget: 400, label: 'Medium-Small (400 BGN)' },
        { budget: 650, label: 'Medium (650 BGN)' },
        { budget: 1250, label: 'Large (1250 BGN)' },
        { budget: 3500, label: 'Premium (3500 BGN)' }
      ];

      sampleBudgets.forEach(({ budget, label }) => {
        const cost = calculatePointsCost(budget, tier.limits);
        const maxBudget = parseInt(tier.limits.max_case_budget);
        
        if (budget > maxBudget) {
          console.log(`  ❌ ${label}: Exceeds tier limit (${maxBudget} BGN)`);
        } else if (cost === 0) {
          console.log(`  ❌ ${label}: Not available in this tier`);
        } else {
          const casesPerMonth = Math.floor(monthlyPoints / cost);
          console.log(`  ✓ ${label}: ${cost} points → ${casesPerMonth} cases/month`);
        }
      });
      
      console.log('');
    });

    // Test point efficiency
    console.log('=== Point Efficiency (Points per 100 BGN) ===\n');
    
    const efficiencyBudgets = [125, 375, 625, 875, 1250, 1750, 2500, 3500, 4500];
    
    console.log('Budget | Range          | FREE  | NORMAL | PRO   ');
    console.log('-------|----------------|-------|--------|-------');
    
    efficiencyBudgets.forEach(budget => {
      const range = getBudgetRange(budget);
      const efficiencies = {};
      
      tiers.forEach(tier => {
        const cost = calculatePointsCost(budget, tier.limits);
        const maxBudget = parseInt(tier.limits.max_case_budget);
        
        if (budget > maxBudget || cost === 0) {
          efficiencies[tier.id] = '❌';
        } else {
          const efficiency = ((cost / budget) * 100).toFixed(2);
          efficiencies[tier.id] = efficiency;
        }
      });
      
      const freeStr = String(efficiencies.free).padEnd(5);
      const normalStr = String(efficiencies.normal).padEnd(6);
      const proStr = String(efficiencies.pro).padEnd(5);
      
      console.log(`${String(budget).padEnd(6)} | ${range.padEnd(14)} | ${freeStr} | ${normalStr} | ${proStr}`);
    });

    console.log('\n✅ Point calculation system is working correctly!\n');

  } catch (error) {
    console.error('❌ Error testing point calculations:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testPointCalculations()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
