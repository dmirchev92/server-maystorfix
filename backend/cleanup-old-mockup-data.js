/**
 * Delete old mockup income data (keep only mirchev92@yahoo.com data)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🧹 Cleaning up old mockup data...');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// First, get mirchev's provider ID
db.get("SELECT id FROM users WHERE email = 'mirchev92@yahoo.com'", (err, mirchev) => {
  if (err || !mirchev) {
    console.error('❌ Could not find mirchev92@yahoo.com');
    db.close();
    process.exit(1);
  }

  const mirchevId = mirchev.id;
  console.log('👤 Mirchev provider ID:', mirchevId);

  // Get all income records grouped by provider
  db.all('SELECT provider_id, COUNT(*) as count FROM case_income GROUP BY provider_id', (err, rows) => {
    if (err) {
      console.error('❌ Error querying income:', err);
      db.close();
      process.exit(1);
    }

    console.log('\n📊 Current income data:');
    rows.forEach(row => {
      const isMirchev = row.provider_id === mirchevId;
      console.log(`   Provider ${row.provider_id}: ${row.count} records ${isMirchev ? '(KEEP - mirchev)' : '(DELETE - old mockup)'}`);
    });

    // Delete all income records that are NOT for mirchev
    console.log('\n🗑️  Deleting old mockup data...');
    db.run('DELETE FROM case_income WHERE provider_id != ?', [mirchevId], function(err) {
      if (err) {
        console.error('❌ Error deleting old data:', err);
        db.close();
        process.exit(1);
      }

      console.log(`✅ Deleted ${this.changes} old mockup records`);

      // Verify what's left
      db.get('SELECT COUNT(*) as count FROM case_income WHERE provider_id = ?', [mirchevId], (err, result) => {
        if (err) {
          console.error('❌ Error verifying:', err);
        } else {
          console.log(`✅ Kept ${result.count} records for mirchev92@yahoo.com`);
        }

        console.log('\n🎉 Cleanup complete!');
        db.close();
      });
    });
  });
});
