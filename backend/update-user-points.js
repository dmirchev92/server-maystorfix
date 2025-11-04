const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: 'postgres', // Use postgres superuser
});

async function updateUserPoints() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Updating points for all tradesperson users...\n');
    
    // Update FREE tier users
    const freeResult = await client.query(`
      UPDATE users 
      SET 
        points_balance = 40,
        points_total_earned = 40,
        points_total_spent = 0,
        points_last_reset = CURRENT_TIMESTAMP
      WHERE role = 'tradesperson' AND subscription_tier_id = 'free'
      RETURNING id, email, points_balance
    `);
    console.log(`✅ Updated ${freeResult.rowCount} FREE tier users with 40 points`);
    
    // Update NORMAL tier users
    const normalResult = await client.query(`
      UPDATE users 
      SET 
        points_balance = 150,
        points_total_earned = 150,
        points_total_spent = 0,
        points_last_reset = CURRENT_TIMESTAMP
      WHERE role = 'tradesperson' AND subscription_tier_id = 'normal'
      RETURNING id, email, points_balance
    `);
    console.log(`✅ Updated ${normalResult.rowCount} NORMAL tier users with 150 points`);
    
    // Update PRO tier users
    const proResult = await client.query(`
      UPDATE users 
      SET 
        points_balance = 250,
        points_total_earned = 250,
        points_total_spent = 0,
        points_last_reset = CURRENT_TIMESTAMP
      WHERE role = 'tradesperson' AND subscription_tier_id = 'pro'
      RETURNING id, email, points_balance
    `);
    console.log(`✅ Updated ${proResult.rowCount} PRO tier users with 250 points`);
    
    // Show summary
    console.log('\n📊 Summary of points by tier:');
    const summary = await client.query(`
      SELECT 
        subscription_tier_id as tier,
        COUNT(*) as user_count,
        points_balance as points
      FROM users 
      WHERE role = 'tradesperson'
      GROUP BY subscription_tier_id, points_balance
      ORDER BY subscription_tier_id
    `);
    
    console.table(summary.rows);
    
    console.log('\n✅ All users updated successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateUserPoints();
