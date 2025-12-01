/**
 * Points System V2 Migration
 * 
 * Implements Option 3 + Option 4:
 * - Reduced monthly points (15/60/100)
 * - Moderate point costs per budget range
 * - Extra points purchase (NORMAL: 5 BGN/pt, PRO: 4 BGN/pt)
 * - Budget ranges up to 10k BGN
 * - Winner-pays-only model (no participation fees)
 * 
 * Target: ~10-12% effective commission
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'C58acfd5c!'
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Starting Points System V2 Migration...\n');
    
    await client.query('BEGIN');

    // ========================================================================
    // 1. UPDATE FREE TIER
    // Points: 15/month, Max Budget: 500 BGN, Cannot buy extra points
    // ========================================================================
    console.log('Updating FREE tier...');
    await client.query(`
      UPDATE subscription_tiers 
      SET limits = limits || $1::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'free'
    `, [JSON.stringify({
      points_monthly: 15,
      max_case_budget: 500,
      points_cost_1_250: 5,
      points_cost_250_500: 8,
      points_cost_500_750: 0,
      points_cost_750_1000: 0,
      points_cost_1000_1500: 0,
      points_cost_1500_2000: 0,
      points_cost_2000_3000: 0,
      points_cost_3000_4000: 0,
      points_cost_4000_5000: 0,
      points_cost_5000_7500: 0,
      points_cost_7500_10000: 0,
      extra_points_price: null
    })]);
    console.log('✓ FREE tier updated');

    // ========================================================================
    // 2. UPDATE NORMAL TIER
    // Points: 60/month, Max Budget: 1500 BGN, Extra points: 5 BGN each
    // ========================================================================
    console.log('Updating NORMAL tier...');
    await client.query(`
      UPDATE subscription_tiers 
      SET limits = limits || $1::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'normal'
    `, [JSON.stringify({
      points_monthly: 60,
      max_case_budget: 1500,
      points_cost_1_250: 5,
      points_cost_250_500: 7,
      points_cost_500_750: 10,
      points_cost_750_1000: 14,
      points_cost_1000_1500: 18,
      points_cost_1500_2000: 0,
      points_cost_2000_3000: 0,
      points_cost_3000_4000: 0,
      points_cost_4000_5000: 0,
      points_cost_5000_7500: 0,
      points_cost_7500_10000: 0,
      extra_points_price: 5
    })]);
    console.log('✓ NORMAL tier updated');

    // ========================================================================
    // 3. UPDATE PRO TIER
    // Points: 100/month, Max Budget: Unlimited, Extra points: 4 BGN each
    // ========================================================================
    console.log('Updating PRO tier...');
    await client.query(`
      UPDATE subscription_tiers 
      SET limits = limits || $1::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'pro'
    `, [JSON.stringify({
      points_monthly: 100,
      max_case_budget: 999999,
      points_cost_1_250: 4,
      points_cost_250_500: 6,
      points_cost_500_750: 8,
      points_cost_750_1000: 11,
      points_cost_1000_1500: 14,
      points_cost_1500_2000: 18,
      points_cost_2000_3000: 24,
      points_cost_3000_4000: 32,
      points_cost_4000_5000: 40,
      points_cost_5000_7500: 55,
      points_cost_7500_10000: 70,
      extra_points_price: 4
    })]);
    console.log('✓ PRO tier updated');

    // ========================================================================
    // 4. UPDATE EXISTING USER POINTS BALANCES
    // Reset all SP points to their new tier allocation
    // ========================================================================
    console.log('\nResetting user points to new allocations...');
    const resetResult = await client.query(`
      UPDATE users u
      SET 
        points_balance = COALESCE(
          (SELECT (st.limits->>'points_monthly')::INTEGER
           FROM subscription_tiers st
           WHERE st.id = u.subscription_tier_id),
          15
        ),
        points_last_reset = CURRENT_TIMESTAMP
      WHERE role = 'tradesperson'
      RETURNING id, subscription_tier_id, points_balance
    `);
    console.log(`✓ Reset points for ${resetResult.rowCount} service providers`);

    await client.query('COMMIT');

    // ========================================================================
    // 5. VERIFICATION
    // ========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION - New Points System');
    console.log('='.repeat(60) + '\n');

    const result = await client.query(`
      SELECT 
        id, 
        name,
        price_monthly,
        limits->>'points_monthly' as monthly_points,
        limits->>'max_case_budget' as max_budget,
        limits->>'extra_points_price' as extra_price,
        limits->>'points_cost_1_250' as "1-250",
        limits->>'points_cost_250_500' as "250-500",
        limits->>'points_cost_500_750' as "500-750",
        limits->>'points_cost_750_1000' as "750-1K",
        limits->>'points_cost_1000_1500' as "1K-1.5K",
        limits->>'points_cost_1500_2000' as "1.5K-2K",
        limits->>'points_cost_2000_3000' as "2K-3K",
        limits->>'points_cost_3000_4000' as "3K-4K",
        limits->>'points_cost_4000_5000' as "4K-5K",
        limits->>'points_cost_5000_7500' as "5K-7.5K",
        limits->>'points_cost_7500_10000' as "7.5K-10K"
      FROM subscription_tiers
      ORDER BY display_order
    `);

    console.log('TIER CONFIGURATION:');
    console.log('-'.repeat(60));
    result.rows.forEach(tier => {
      console.log(`\n${tier.name.toUpperCase()} (${tier.price_monthly} BGN/month)`);
      console.log(`  Monthly Points: ${tier.monthly_points}`);
      console.log(`  Max Budget: ${tier.max_budget === '999999' ? 'Unlimited' : tier.max_budget + ' BGN'}`);
      console.log(`  Extra Points Price: ${tier.extra_price ? tier.extra_price + ' BGN/point' : 'Not available'}`);
      console.log(`  Point Costs by Budget:`);
      if (tier['1-250'] > 0) console.log(`    1-250 BGN: ${tier['1-250']} points`);
      if (tier['250-500'] > 0) console.log(`    250-500 BGN: ${tier['250-500']} points`);
      if (tier['500-750'] > 0) console.log(`    500-750 BGN: ${tier['500-750']} points`);
      if (tier['750-1K'] > 0) console.log(`    750-1000 BGN: ${tier['750-1K']} points`);
      if (tier['1K-1.5K'] > 0) console.log(`    1000-1500 BGN: ${tier['1K-1.5K']} points`);
      if (tier['1.5K-2K'] > 0) console.log(`    1500-2000 BGN: ${tier['1.5K-2K']} points`);
      if (tier['2K-3K'] > 0) console.log(`    2000-3000 BGN: ${tier['2K-3K']} points`);
      if (tier['3K-4K'] > 0) console.log(`    3000-4000 BGN: ${tier['3K-4K']} points`);
      if (tier['4K-5K'] > 0) console.log(`    4000-5000 BGN: ${tier['4K-5K']} points`);
      if (tier['5K-7.5K'] > 0) console.log(`    5000-7500 BGN: ${tier['5K-7.5K']} points`);
      if (tier['7.5K-10K'] > 0) console.log(`    7500-10000 BGN: ${tier['7.5K-10K']} points`);
    });

    // Calculate monthly win potential
    console.log('\n' + '='.repeat(60));
    console.log('MONTHLY WIN POTENTIAL (Small cases @ 1-250 BGN)');
    console.log('='.repeat(60));
    result.rows.forEach(tier => {
      const points = parseInt(tier.monthly_points);
      const costSmall = parseInt(tier['1-250']) || 0;
      const winsSmall = costSmall > 0 ? Math.floor(points / costSmall) : 0;
      const workValue = winsSmall * 200; // avg 200 BGN per small job
      const commission = tier.price_monthly > 0 ? ((tier.price_monthly / workValue) * 100).toFixed(1) : 'N/A';
      
      console.log(`\n${tier.name.toUpperCase()}:`);
      console.log(`  Max Small Wins: ${winsSmall} jobs`);
      console.log(`  Work Value: ~${workValue} BGN`);
      console.log(`  Effective Commission: ${commission}%`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Points System V2 Migration completed successfully!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrate().catch(console.error);
