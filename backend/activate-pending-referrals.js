const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path - use the same path as other scripts
const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔄 Activating pending referrals...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// First, check current referral statuses
db.all("SELECT id, referrer_user_id, referred_user_id, status, created_at FROM sp_referrals", (err, referrals) => {
  if (err) {
    console.error('❌ Error getting referrals:', err);
    db.close();
    return;
  }

  console.log('\n📊 Current referral statuses:');
  console.log('='.repeat(60));
  
  if (referrals.length === 0) {
    console.log('No referrals found');
  } else {
    referrals.forEach((referral, index) => {
      console.log(`${index + 1}. ID: ${referral.id}`);
      console.log(`   Referrer: ${referral.referrer_user_id}`);
      console.log(`   Referred: ${referral.referred_user_id}`);
      console.log(`   Status: ${referral.status}`);
      console.log(`   Created: ${referral.created_at}`);
      console.log('');
    });
  }

  // Count by status
  const statusCounts = referrals.reduce((acc, ref) => {
    acc[ref.status] = (acc[ref.status] || 0) + 1;
    return acc;
  }, {});

  console.log('📈 Status summary:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  // Activate all pending referrals
  const pendingCount = statusCounts.pending || 0;
  
  if (pendingCount > 0) {
    console.log(`\n🔄 Activating ${pendingCount} pending referrals...`);
    
    db.run(
      "UPDATE sp_referrals SET status = 'active', activated_at = datetime('now') WHERE status = 'pending'",
      function(err) {
        if (err) {
          console.error('❌ Error activating referrals:', err);
        } else {
          console.log(`✅ Successfully activated ${this.changes} referrals`);
          
          // Verify the update
          db.all("SELECT status, COUNT(*) as count FROM sp_referrals GROUP BY status", (verifyErr, statusRows) => {
            if (!verifyErr && statusRows) {
              console.log('\n📊 Updated status summary:');
              statusRows.forEach(row => {
                console.log(`   ${row.status}: ${row.count}`);
              });
            }
            
            console.log('\n🎉 All referrals are now active and ready for click tracking!');
            db.close();
          });
        }
      }
    );
  } else {
    console.log('\n✅ No pending referrals to activate');
    db.close();
  }
});
