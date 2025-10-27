const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔧 Adding missing customer_id column to marketplace_service_cases table');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// First, let's check the current table structure
db.all("PRAGMA table_info(marketplace_service_cases)", (err, rows) => {
  if (err) {
    console.error('❌ Error getting table info:', err.message);
    db.close();
    return;
  }
  
  console.log('\n📊 Current marketplace_service_cases table structure:');
  rows.forEach(row => {
    console.log(`  - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
  });
  
  // Check if customer_id column exists
  const hasCustomerId = rows.some(row => row.name === 'customer_id');
  
  if (hasCustomerId) {
    console.log('\n✅ customer_id column already exists!');
    db.close();
    return;
  }
  
  console.log('\n🔧 Adding customer_id column...');
  
  // Add the missing customer_id column
  db.run("ALTER TABLE marketplace_service_cases ADD COLUMN customer_id TEXT", (err) => {
    if (err) {
      console.error('❌ Error adding customer_id column:', err.message);
    } else {
      console.log('✅ Successfully added customer_id column');
    }
    
    // Verify the column was added
    db.all("PRAGMA table_info(marketplace_service_cases)", (err, rows) => {
      if (err) {
        console.error('❌ Error verifying table structure:', err.message);
      } else {
        console.log('\n📊 Updated marketplace_service_cases table structure:');
        rows.forEach(row => {
          console.log(`  - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
        });
        
        const hasCustomerId = rows.some(row => row.name === 'customer_id');
        if (hasCustomerId) {
          console.log('\n🎉 customer_id column successfully added!');
          console.log('💡 Please restart your backend server to apply the changes.');
        } else {
          console.log('\n❌ customer_id column was not added properly');
        }
      }
      
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err.message);
        } else {
          console.log('✅ Database connection closed');
        }
      });
    });
  });
});
