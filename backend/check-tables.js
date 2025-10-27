const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('🔍 Checking all database tables...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Get all tables
db.all("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
  if (err) {
    console.error('❌ Error getting tables:', err);
    db.close();
    return;
  }

  console.log('\n📋 All tables in database:');
  console.log('='.repeat(50));
  
  if (tables.length === 0) {
    console.log('No tables found in database');
  } else {
    tables.forEach((table, index) => {
      console.log(`\n${index + 1}. Table: ${table.name}`);
      console.log('Schema:', table.sql);
      
      // Check for referral-related tables
      if (table.name.includes('referral')) {
        console.log('🎯 REFERRAL-RELATED TABLE FOUND!');
      }
    });
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🔍 Looking specifically for referral tables...');
  
  // Check for any table that might contain referral data
  const referralTableNames = [
    'sp_referrals',
    'sp_referral_codes', 
    'referrals',
    'referral_codes',
    'user_referrals',
    'marketplace_referrals'
  ];
  
  let foundTables = [];
  let checkCount = 0;
  
  referralTableNames.forEach(tableName => {
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`, (err, row) => {
      checkCount++;
      if (row) {
        foundTables.push(tableName);
        console.log(`✅ Found: ${tableName}`);
      } else {
        console.log(`❌ Missing: ${tableName}`);
      }
      
      if (checkCount === referralTableNames.length) {
        console.log('\n📊 Summary:');
        console.log('Found referral tables:', foundTables.length > 0 ? foundTables.join(', ') : 'None');
        
        if (foundTables.length === 0) {
          console.log('\n🚨 PROBLEM: No referral tables found!');
          console.log('💡 Solution: Need to create the referral tables');
        }
        
        db.close();
      }
    });
  });
});
