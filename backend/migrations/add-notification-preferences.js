/**
 * Add Notification Preferences Table
 * Stores user preferences for push and email notifications
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
    console.log('Creating notification_preferences table...\n');
    
    await client.query('BEGIN');

    // Create notification preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        
        -- Push notification preferences
        push_enabled BOOLEAN DEFAULT true,
        push_new_cases BOOLEAN DEFAULT true,
        push_chat_messages BOOLEAN DEFAULT true,
        push_bid_won BOOLEAN DEFAULT true,
        push_new_bids BOOLEAN DEFAULT true,
        push_reviews BOOLEAN DEFAULT true,
        push_points_subscription BOOLEAN DEFAULT true,
        
        -- Email notification preferences
        email_enabled BOOLEAN DEFAULT true,
        email_weekly_report BOOLEAN DEFAULT true,
        email_new_cases BOOLEAN DEFAULT false,
        email_bid_won BOOLEAN DEFAULT true,
        email_reviews BOOLEAN DEFAULT true,
        email_marketing BOOLEAN DEFAULT false,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ notification_preferences table created');

    // Create index on user_id
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id 
      ON notification_preferences(user_id)
    `);
    console.log('✓ Index created');

    // Insert default preferences for existing users
    await client.query(`
      INSERT INTO notification_preferences (id, user_id)
      SELECT 
        'notif_pref_' || SUBSTRING(id, 1, 20),
        id
      FROM users
      WHERE id NOT IN (SELECT user_id FROM notification_preferences)
      ON CONFLICT (user_id) DO NOTHING
    `);
    console.log('✓ Default preferences created for existing users');

    await client.query('COMMIT');

    // Verify
    const result = await client.query(`
      SELECT COUNT(*) as count FROM notification_preferences
    `);
    console.log(`\n✅ Migration complete. ${result.rows[0].count} preference records created.`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
