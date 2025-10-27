const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔍 Checking ALL tables in database...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to SQLite database');
});

// First, get all table names
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('❌ Error getting tables:', err.message);
    return;
  }
  
  console.log('\n📋 All tables in database:');
  tables.forEach(table => {
    console.log(`- ${table.name}`);
  });
  
  // Check each table for data
  let completed = 0;
  const total = tables.length;
  
  if (total === 0) {
    console.log('\n❌ No tables found in database!');
    db.close();
    return;
  }
  
  console.log('\n📊 Checking data in each table:');
  
  tables.forEach(table => {
    const tableName = table.name;
    
    db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
      if (err) {
        console.error(`❌ Error checking ${tableName}:`, err.message);
      } else {
        console.log(`${tableName}: ${row.count} rows`);
        
        // If table has data, show first few rows
        if (row.count > 0) {
          db.all(`SELECT * FROM ${tableName} LIMIT 3`, (err, rows) => {
            if (err) {
              console.error(`❌ Error getting sample data from ${tableName}:`, err.message);
            } else {
              console.log(`  Sample data from ${tableName}:`, rows);
            }
          });
        }
      }
      
      completed++;
      if (completed === total) {
        console.log('\n🔍 Database check complete');
        db.close();
      }
    });
  });
});
