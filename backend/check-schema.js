const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('🔍 Checking current database schema...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Check sp_referrals table schema
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='sp_referrals'", (err, row) => {
  if (err) {
    console.error('❌ Error checking sp_referrals schema:', err);
  } else {
    console.log('\n📋 sp_referrals table schema:');
    console.log(row ? row.sql : 'Table not found');
    
    if (row && row.sql.includes('UNIQUE') && row.sql.includes('referral_code')) {
      console.log('\n❌ PROBLEM: UNIQUE constraint still exists on referral_code!');
    } else {
      console.log('\n✅ Schema looks correct - no UNIQUE constraint on referral_code');
    }
  }
  
  // Check sp_referral_codes table schema
  db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='sp_referral_codes'", (err2, row2) => {
    if (err2) {
      console.error('❌ Error checking sp_referral_codes schema:', err2);
    } else {
      console.log('\n📋 sp_referral_codes table schema:');
      console.log(row2 ? row2.sql : 'Table not found');
    }
    
    // Check current data in both tables
    db.all("SELECT COUNT(*) as count FROM sp_referrals", (err3, rows3) => {
      console.log('\n📊 Current data:');
      console.log('sp_referrals count:', rows3 ? rows3[0].count : 'Error');
      
      db.all("SELECT COUNT(*) as count FROM sp_referral_codes", (err4, rows4) => {
        console.log('sp_referral_codes count:', rows4 ? rows4[0].count : 'Error');
        
        // Show some sample data
        db.all("SELECT referral_code, COUNT(*) as usage_count FROM sp_referrals GROUP BY referral_code", (err5, rows5) => {
          console.log('\n📈 Referral code usage:');
          if (rows5 && rows5.length > 0) {
            rows5.forEach(row => {
              console.log(`  ${row.referral_code}: used ${row.usage_count} times`);
            });
          } else {
            console.log('  No referral data found');
          }
          
          db.close();
        });
      });
    });
  });
});
