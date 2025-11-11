/**
 * Update Fair Point Allocation System
 * Implements granular budget ranges with fair point costs
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'servicetextpro',
  password: process.env.POSTGRES_PASSWORD || 'C58acfd5c!'
});

async function updateFairPointAllocation() {
  const client = await pool.connect();
  
  try {
    console.log('Starting fair point allocation update...\n');
    
    await client.query('BEGIN');

    // ========================================================================
    // 1. UPDATE FREE TIER (40 points/month, max 500 BGN)
    // ========================================================================
    console.log('Updating FREE tier...');
    await client.query(`
      UPDATE subscription_tiers 
      SET limits = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        limits,
                        '{points_cost_1_250}', '6'
                      ),
                      '{points_cost_250_500}', '10'
                    ),
                    '{points_cost_500_750}', '0'
                  ),
                  '{points_cost_750_1000}', '0'
                ),
                '{points_cost_1000_1500}', '0'
              ),
              '{points_cost_1500_2000}', '0'
            ),
            '{points_cost_2000_3000}', '0'
          ),
          '{points_cost_3000_4000}', '0'
        ),
        '{points_cost_4000_5000}', '0'
      )
      WHERE id = 'free'
    `);
    console.log('✓ FREE tier updated');

    // ========================================================================
    // 2. UPDATE NORMAL TIER (150 points/month, max 1500 BGN)
    // ========================================================================
    console.log('Updating NORMAL tier...');
    await client.query(`
      UPDATE subscription_tiers 
      SET limits = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        limits,
                        '{points_cost_1_250}', '4'
                      ),
                      '{points_cost_250_500}', '7'
                    ),
                    '{points_cost_500_750}', '12'
                  ),
                  '{points_cost_750_1000}', '18'
                ),
                '{points_cost_1000_1500}', '25'
              ),
              '{points_cost_1500_2000}', '0'
            ),
            '{points_cost_2000_3000}', '0'
          ),
          '{points_cost_3000_4000}', '0'
        ),
        '{points_cost_4000_5000}', '0'
      )
      WHERE id = 'normal'
    `);
    console.log('✓ NORMAL tier updated');

    // ========================================================================
    // 3. UPDATE PRO TIER (250 points/month, unlimited budget)
    // ========================================================================
    console.log('Updating PRO tier...');
    await client.query(`
      UPDATE subscription_tiers 
      SET limits = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        limits,
                        '{points_cost_1_250}', '3'
                      ),
                      '{points_cost_250_500}', '5'
                    ),
                    '{points_cost_500_750}', '8'
                  ),
                  '{points_cost_750_1000}', '12'
                ),
                '{points_cost_1000_1500}', '18'
              ),
              '{points_cost_1500_2000}', '25'
            ),
            '{points_cost_2000_3000}', '35'
          ),
          '{points_cost_3000_4000}', '45'
        ),
        '{points_cost_4000_5000}', '55'
      )
      WHERE id = 'pro'
    `);
    console.log('✓ PRO tier updated');

    // ========================================================================
    // 4. REMOVE OLD POINT COST FIELDS
    // ========================================================================
    console.log('Cleaning up old point cost fields...');
    await client.query(`
      UPDATE subscription_tiers 
      SET limits = limits - 'points_cost_1_500' - 'points_cost_500_1000'
      WHERE limits ? 'points_cost_1_500' OR limits ? 'points_cost_500_1000'
    `);
    console.log('✓ Old fields removed');

    await client.query('COMMIT');

    // ========================================================================
    // 5. VERIFICATION
    // ========================================================================
    console.log('\n=== Verification ===\n');
    const result = await client.query(`
      SELECT 
        id, 
        name,
        limits->>'points_monthly' as monthly_points,
        limits->>'max_case_budget' as max_budget,
        limits->>'points_cost_1_250' as cost_1_250,
        limits->>'points_cost_250_500' as cost_250_500,
        limits->>'points_cost_500_750' as cost_500_750,
        limits->>'points_cost_750_1000' as cost_750_1000,
        limits->>'points_cost_1000_1500' as cost_1000_1500,
        limits->>'points_cost_1500_2000' as cost_1500_2000,
        limits->>'points_cost_2000_3000' as cost_2000_3000,
        limits->>'points_cost_3000_4000' as cost_3000_4000,
        limits->>'points_cost_4000_5000' as cost_4000_5000
      FROM subscription_tiers
      ORDER BY display_order
    `);

    console.log('Updated Tier Configuration:');
    console.table(result.rows);

    // Calculate and display monthly access potential
    console.log('\n=== Monthly Access Potential ===\n');
    
    result.rows.forEach(tier => {
      const monthlyPoints = parseInt(tier.monthly_points);
      console.log(`${tier.name.toUpperCase()} Tier (${monthlyPoints} points/month):`);
      
      if (tier.cost_1_250 > 0) {
        const smallCases = Math.floor(monthlyPoints / parseInt(tier.cost_1_250));
        console.log(`  • ${smallCases} small cases (1-250 BGN) at ${tier.cost_1_250} points each`);
      }
      
      if (tier.cost_250_500 > 0) {
        const mediumSmallCases = Math.floor(monthlyPoints / parseInt(tier.cost_250_500));
        console.log(`  • ${mediumSmallCases} medium-small cases (250-500 BGN) at ${tier.cost_250_500} points each`);
      }
      
      if (tier.cost_500_750 > 0) {
        const mediumCases = Math.floor(monthlyPoints / parseInt(tier.cost_500_750));
        console.log(`  • ${mediumCases} medium cases (500-750 BGN) at ${tier.cost_500_750} points each`);
      }
      
      if (tier.cost_1000_1500 > 0) {
        const largeCases = Math.floor(monthlyPoints / parseInt(tier.cost_1000_1500));
        console.log(`  • ${largeCases} large cases (1000-1500 BGN) at ${tier.cost_1000_1500} points each`);
      }
      
      if (tier.cost_3000_4000 > 0) {
        const premiumCases = Math.floor(monthlyPoints / parseInt(tier.cost_3000_4000));
        console.log(`  • ${premiumCases} premium cases (3000-4000 BGN) at ${tier.cost_3000_4000} points each`);
      }
      
      console.log('');
    });

    console.log('✅ Fair point allocation update completed successfully!\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating fair point allocation:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the update
updateFairPointAllocation()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
