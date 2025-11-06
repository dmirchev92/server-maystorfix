/**
 * Migration: Add square_meters column to marketplace_service_cases
 * This field is useful for services measured by area (painter, cleaner, flooring, etc.)
 */

const { Pool } = require('pg');
require('dotenv').config({ path: './config/.env' });

async function runMigration() {
  console.log('🔄 Starting migration: add_square_meters');
  
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'servicetext_pro',
    user: process.env.POSTGRES_USER || 'servicetextpro',
    password: process.env.POSTGRES_PASSWORD,
  });
  
  try {
    console.log('📊 Connecting to PostgreSQL database...');
    
    // Add square_meters column
    await pool.query(`
      ALTER TABLE marketplace_service_cases 
      ADD COLUMN IF NOT EXISTS square_meters NUMERIC;
    `);
    
    console.log('✅ Added square_meters column to marketplace_service_cases');
    
    // Add comment
    await pool.query(`
      COMMENT ON COLUMN marketplace_service_cases.square_meters 
      IS 'Area in square meters for services that are measured by area (painting, cleaning, flooring, etc.)';
    `);
    
    console.log('✅ Added column comment');
    console.log('✅ Migration completed successfully');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
