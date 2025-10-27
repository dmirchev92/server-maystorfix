const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path - use the same path as other scripts
const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔧 Fixing referral database constraint...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

async function fixReferralConstraint() {
  return new Promise((resolve, reject) => {
    // First, let's check the current schema
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='sp_referrals'", (err, row) => {
      if (err) {
        console.error('❌ Error checking table schema:', err);
        reject(err);
        return;
      }

      console.log('📋 Current sp_referrals table schema:');
      console.log(row ? row.sql : 'Table not found');

      // Check if the table has the UNIQUE constraint on referral_code
      if (row && row.sql.includes('referral_code') && row.sql.includes('UNIQUE')) {
        console.log('🔍 Found UNIQUE constraint on referral_code - this needs to be fixed');
        
        // SQLite doesn't support DROP CONSTRAINT, so we need to recreate the table
        db.serialize(() => {
          // Step 1: Create backup of existing data
          console.log('📦 Creating backup of existing referrals...');
          db.run(`CREATE TABLE sp_referrals_backup AS SELECT * FROM sp_referrals`, (backupErr) => {
            if (backupErr) {
              console.error('❌ Error creating backup:', backupErr);
              reject(backupErr);
              return;
            }

            // Step 2: Drop the old table
            console.log('🗑️ Dropping old table...');
            db.run(`DROP TABLE sp_referrals`, (dropErr) => {
              if (dropErr) {
                console.error('❌ Error dropping table:', dropErr);
                reject(dropErr);
                return;
              }

              // Step 3: Create new table without UNIQUE constraint on referral_code
              console.log('🏗️ Creating new table with correct schema...');
              db.run(`
                CREATE TABLE sp_referrals (
                  id TEXT PRIMARY KEY,
                  referrer_user_id TEXT NOT NULL,
                  referred_user_id TEXT NOT NULL,
                  referral_code TEXT NOT NULL,
                  status TEXT DEFAULT 'pending',
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  activated_at DATETIME,
                  FOREIGN KEY (referrer_user_id) REFERENCES users(id),
                  FOREIGN KEY (referred_user_id) REFERENCES users(id),
                  UNIQUE(referrer_user_id, referred_user_id)
                )
              `, (createErr) => {
                if (createErr) {
                  console.error('❌ Error creating new table:', createErr);
                  reject(createErr);
                  return;
                }

                // Step 4: Restore data from backup
                console.log('📥 Restoring data from backup...');
                db.run(`
                  INSERT INTO sp_referrals (id, referrer_user_id, referred_user_id, referral_code, status, created_at, activated_at)
                  SELECT id, referrer_user_id, referred_user_id, referral_code, 
                         COALESCE(status, 'pending'), 
                         COALESCE(created_at, datetime('now')), 
                         activated_at
                  FROM sp_referrals_backup
                `, (restoreErr) => {
                  if (restoreErr) {
                    console.error('❌ Error restoring data:', restoreErr);
                    reject(restoreErr);
                    return;
                  }

                  // Step 5: Drop backup table
                  console.log('🧹 Cleaning up backup table...');
                  db.run(`DROP TABLE sp_referrals_backup`, (cleanupErr) => {
                    if (cleanupErr) {
                      console.warn('⚠️ Warning: Could not drop backup table:', cleanupErr);
                    }

                    console.log('✅ Successfully fixed referral constraint!');
                    console.log('📋 New schema allows multiple referrals per referral code');
                    resolve();
                  });
                });
              });
            });
          });
        });
      } else {
        console.log('✅ Table schema looks correct - no UNIQUE constraint on referral_code');
        resolve();
      }
    });
  });
}

// Run the fix
fixReferralConstraint()
  .then(() => {
    console.log('🎉 Database constraint fix completed successfully!');
    db.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed to fix database constraint:', error);
    db.close();
    process.exit(1);
  });
