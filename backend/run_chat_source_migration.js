// Run chat source tracking migration
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'servicetextpro',
  user: 'postgres',
  password: 'C58acfd5c!'
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting chat source tracking migration...');
    
    // Add chat_source to marketplace_conversations
    await client.query(`
      ALTER TABLE marketplace_conversations 
      ADD COLUMN IF NOT EXISTS chat_source VARCHAR(50) DEFAULT 'direct'
    `);
    console.log('✅ Added chat_source to marketplace_conversations');
    
    // Add chat_source to marketplace_service_cases
    await client.query(`
      ALTER TABLE marketplace_service_cases 
      ADD COLUMN IF NOT EXISTS chat_source VARCHAR(50)
    `);
    console.log('✅ Added chat_source to marketplace_service_cases');
    
    // Add indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_chat_source 
      ON marketplace_conversations(chat_source)
    `);
    console.log('✅ Created index on marketplace_conversations.chat_source');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_service_cases_chat_source 
      ON marketplace_service_cases(chat_source)
    `);
    console.log('✅ Created index on marketplace_service_cases.chat_source');
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
