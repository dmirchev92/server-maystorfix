const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔍 Debugging cases in database');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Check all cases in the database
db.all("SELECT * FROM marketplace_service_cases ORDER BY created_at DESC LIMIT 10", (err, rows) => {
  if (err) {
    console.error('❌ Error getting cases:', err.message);
    db.close();
    return;
  }
  
  console.log(`\n📊 Found ${rows.length} cases in database:`);
  
  if (rows.length === 0) {
    console.log('  No cases found in database');
  } else {
    rows.forEach((row, index) => {
      console.log(`\n  Case ${index + 1}:`);
      console.log(`    ID: ${row.id}`);
      console.log(`    Service Type: ${row.service_type}`);
      console.log(`    Description: ${row.description}`);
      console.log(`    Status: ${row.status}`);
      console.log(`    Customer ID: ${row.customer_id || 'NULL'}`);
      console.log(`    Provider ID: ${row.provider_id || 'NULL'}`);
      console.log(`    Category: ${row.category || 'NULL'}`);
      console.log(`    Is Open Case: ${row.is_open_case}`);
      console.log(`    Created At: ${row.created_at}`);
    });
  }
  
  // Also check users table to see available user IDs
  console.log('\n👥 Checking users in database:');
  db.all("SELECT id, email, first_name, last_name, role FROM users LIMIT 5", (err, users) => {
    if (err) {
      console.error('❌ Error getting users:', err.message);
    } else {
      console.log(`\n📊 Found ${users.length} users:`);
      users.forEach((user, index) => {
        console.log(`  User ${index + 1}: ${user.first_name} ${user.last_name} (${user.email}) - Role: ${user.role} - ID: ${user.id}`);
      });
    }
    
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('\n✅ Database connection closed');
      }
    });
  });
});
