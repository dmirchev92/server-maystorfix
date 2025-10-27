// Check existing table structure
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking existing table structure...');

// Check if users table exists and its structure
db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'", (err, rows) => {
  if (err) {
    console.error('❌ Error:', err.message);
  } else if (rows.length === 0) {
    console.log('ℹ️  Users table does not exist');
  } else {
    console.log('📋 Users table structure:');
    console.log(rows[0].sql);
  }
  
  // Also check what tables exist
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('❌ Error getting tables:', err.message);
    } else {
      console.log('\n📊 Existing tables:');
      tables.forEach(table => console.log('  -', table.name));
    }
    
    db.close();
  });
});
