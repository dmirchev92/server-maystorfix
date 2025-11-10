const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'servicetext_pro',
  user: 'servicetextpro',
  password: 'C58acfd5c!',
});

async function queryLatestAbvUser() {
  try {
    const result = await pool.query(`
      SELECT id, email, first_name, last_name, role, subscription_tier_id, created_at 
      FROM users 
      WHERE email LIKE '%@abv.bg' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n=== Latest users with @abv.bg email ===\n');
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.first_name} ${user.last_name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Tier: ${user.subscription_tier_id}`);
      console.log(`   Created: ${user.created_at}`);
      console.log('');
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error querying database:', error);
    process.exit(1);
  }
}

queryLatestAbvUser();
