const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'servicetextpro',
  password: process.env.POSTGRES_PASSWORD
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running price bidding migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '027_add_price_bidding_fields.sql'),
      'utf8'
    );
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the new columns
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sp_case_bids' 
      AND column_name IN ('proposed_budget_range', 'bid_comment', 'participation_points')
      ORDER BY column_name;
    `);
    
    console.log('\n📋 New columns added:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
