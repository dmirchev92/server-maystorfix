const { DatabaseFactory } = require('./dist/models/DatabaseFactory');

const db = DatabaseFactory.getDatabase();

async function queryUsers() {
  try {
    const users = await db.query(`
      SELECT id, email, first_name, last_name, role, subscription_tier_id, created_at 
      FROM users 
      WHERE email LIKE '%@abv.bg' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n=== Latest users with @abv.bg email ===\n');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.first_name} ${user.last_name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Tier: ${user.subscription_tier_id}`);
      console.log(`   Created: ${user.created_at}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

queryUsers();
