/**
 * Initialize Points for User
 * Gives users their monthly point allocation if they haven't received it yet
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'servicetextpro',
  password: process.env.POSTGRES_PASSWORD || 'C58acfd5c!'
});

async function initializeUserPoints(email) {
  const client = await pool.connect();
  
  try {
    console.log(`\n=== Initializing Points for ${email} ===\n`);
    
    await client.query('BEGIN');

    // Get user and tier info
    const userResult = await client.query(`
      SELECT 
        u.id,
        u.email,
        u.subscription_tier_id,
        u.points_balance,
        u.points_last_reset,
        st.limits->>'points_monthly' as monthly_points
      FROM users u
      LEFT JOIN subscription_tiers st ON u.subscription_tier_id = st.id
      WHERE u.email = $1
    `, [email]);

    if (userResult.rows.length === 0) {
      console.log(`❌ User ${email} not found`);
      await client.query('ROLLBACK');
      return;
    }

    const user = userResult.rows[0];
    const monthlyPoints = parseInt(user.monthly_points);

    console.log(`User: ${user.email}`);
    console.log(`Tier: ${user.subscription_tier_id}`);
    console.log(`Current Balance: ${user.points_balance} points`);
    console.log(`Monthly Allowance: ${monthlyPoints} points`);
    console.log(`Last Reset: ${user.points_last_reset || 'Never'}`);

    // Update user points
    await client.query(`
      UPDATE users
      SET 
        points_balance = $1,
        points_total_earned = points_total_earned + $1,
        points_last_reset = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [monthlyPoints, user.id]);

    // Record transaction
    await client.query(`
      INSERT INTO sp_points_transactions (
        id, user_id, transaction_type, points_amount, balance_after, reason
      ) VALUES (
        gen_random_uuid(), $1, 'reset', $2, $2, 'Initial monthly points allocation'
      )
    `, [user.id, monthlyPoints]);

    await client.query('COMMIT');

    console.log(`\n✅ Successfully initialized ${monthlyPoints} points for ${email}`);
    console.log(`New Balance: ${monthlyPoints} points\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing points:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get email from command line or use default
const email = process.argv[2] || 'free@abv.bg';

initializeUserPoints(email)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
