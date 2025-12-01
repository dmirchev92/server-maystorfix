/**
 * Reset All Users Script
 * Clears all user data while keeping reference tables (tiers, categories, etc.)
 * WARNING: This is destructive and cannot be undone!
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'C58acfd5c!'
});

async function resetAllUsers() {
  const client = await pool.connect();
  
  console.log('⚠️  WARNING: This will delete ALL user data!');
  console.log('=' .repeat(50));
  
  try {
    await client.query('BEGIN');
    
    // Tables to clear (in order due to FK constraints)
    const tablesToClear = [
      // Chat & Messages
      'marketplace_chat_receipts',
      'marketplace_chat_attachments', 
      'marketplace_chat_messages',
      'marketplace_chat_participants',
      'marketplace_conversations',
      'chat_sessions',
      'chat_tokens',
      
      // Cases & Bids
      'sp_case_bids',
      'sp_premium_bids',
      'sp_case_access',
      'case_income',
      'case_screenshots',
      'case_reviews',
      'case_assignments',
      'case_queue',
      'marketplace_case_declines',
      'marketplace_service_cases',
      'marketplace_inquiries',
      'service_cases',
      
      // Provider data
      'provider_reviews',
      'provider_certificates',
      'provider_gallery',
      'provider_service_categories',
      'provider_services',
      'provider_location_schedule',
      'service_provider_profiles',
      'service_provider_identifiers',
      
      // Subscriptions & Points
      'sp_points_transactions',
      'sp_subscription_history',
      'sp_subscriptions',
      'sp_feature_usage',
      'sp_sms_packages',
      
      // Referrals
      'referral_sms_claim_tokens',
      'referral_rewards',
      'referral_clicks',
      'sp_referrals',
      'sp_referral_codes',
      
      // Notifications & Devices
      'notifications',
      'notification_preferences',
      'device_tokens',
      
      // SMS & Calls
      'sms_settings',
      'sms_verification_codes',
      'missed_calls',
      
      // Tracking
      'sp_tracking_sessions',
      
      // Auth & GDPR
      'gdpr_consents',
      'gdpr_audit_log',
      'email_verification_tokens',
      'password_reset_tokens',
      'email_logs',
      'business_metrics',
      
      // Finally, users
      'users',
    ];
    
    console.log('\n🗑️  Clearing tables...\n');
    
    for (const table of tablesToClear) {
      try {
        const result = await client.query(`DELETE FROM ${table}`);
        console.log(`  ✓ ${table}: ${result.rowCount} rows deleted`);
      } catch (err) {
        // Table might not exist or have no data
        console.log(`  ⚠ ${table}: ${err.message.split('\n')[0]}`);
      }
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Database cleared successfully!\n');
    
    // Clear uploads folder
    console.log('🗂️  Clearing uploads folder...\n');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    
    if (fs.existsSync(uploadsDir)) {
      const items = fs.readdirSync(uploadsDir);
      for (const item of items) {
        const itemPath = path.join(uploadsDir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          // Remove directory contents
          fs.rmSync(itemPath, { recursive: true, force: true });
          console.log(`  ✓ Removed: ${item}/`);
        } else if (!item.startsWith('.')) {
          fs.unlinkSync(itemPath);
          console.log(`  ✓ Removed: ${item}`);
        }
      }
    }
    
    console.log('\n✅ Uploads folder cleared!\n');
    
    // Show what's preserved
    console.log('📋 Preserved reference tables:');
    
    const preserved = [
      { name: 'subscription_tiers', desc: 'Subscription plans' },
      { name: 'service_categories', desc: 'Service categories' },
      { name: 'case_templates', desc: 'Case templates' },
      { name: 'locations', desc: 'City/neighborhood data' },
    ];
    
    for (const table of preserved) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table.name}`);
      console.log(`  ✓ ${table.name}: ${result.rows[0].count} records (${table.desc})`);
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 Reset complete! Database is ready for fresh testing.');
    console.log('=' .repeat(50));
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Reset failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

resetAllUsers().catch(console.error);
