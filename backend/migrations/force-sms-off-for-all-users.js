const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'servicetext_pro.db');

console.log('🔒 Forcing SMS OFF for all existing users');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database\n');
});

// Update all existing SMS settings to OFF
db.run(
  `UPDATE sms_settings SET is_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE is_enabled = 1`,
  function(err) {
    if (err) {
      console.error('❌ Error updating SMS settings:', err.message);
      db.close();
      process.exit(1);
    }

    console.log(`✅ Updated ${this.changes} user(s) - SMS is now OFF`);

    // Verify the change
    db.all(`SELECT user_id, is_enabled FROM sms_settings`, (err, rows) => {
      if (err) {
        console.error('❌ Error verifying:', err.message);
      } else {
        console.log('\n📊 Current SMS Settings Status:');
        console.log(`   Total users with settings: ${rows.length}`);
        const enabledCount = rows.filter(r => r.is_enabled === 1).length;
        const disabledCount = rows.filter(r => r.is_enabled === 0).length;
        console.log(`   ✅ Enabled: ${enabledCount}`);
        console.log(`   ❌ Disabled: ${disabledCount}`);
      }

      db.close(() => {
        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 SMS Auto-Reply is now:');
        console.log('   ❌ OFF by default for all users');
        console.log('   ✅ Users must explicitly enable it in settings');
        console.log('   🔒 This prevents unwanted SMS charges');
      });
    });
  }
);
