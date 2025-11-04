/**
 * Run Points System Migration
 * Executes the 008_add_points_system.sql migration
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'servicetextpro',
  password: process.env.POSTGRES_PASSWORD,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting points system migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '008_add_points_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Points system migration completed successfully!');
    
    // Verify the migration
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('points_balance', 'points_total_earned', 'points_total_spent', 'points_last_reset')
    `);
    
    console.log('\n📊 Verified new columns in users table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sp_points_transactions', 'sp_case_access')
    `);
    
    console.log('\n📋 New tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check points configuration in tiers
    const tiersResult = await client.query(`
      SELECT id, limits->>'points_monthly' as points_monthly, limits->>'max_case_budget' as max_case_budget
      FROM subscription_tiers
    `);
    
    console.log('\n💰 Points configuration by tier:');
    tiersResult.rows.forEach(row => {
      console.log(`  - ${row.id}: ${row.points_monthly} points/month, max budget: ${row.max_case_budget} BGN`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
