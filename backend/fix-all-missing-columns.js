const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔧 Adding all missing columns to marketplace_service_cases table');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// List of columns that might be missing based on the API requirements
const requiredColumns = [
  { name: 'customer_id', type: 'TEXT' },
  { name: 'category', type: 'TEXT' },
  { name: 'location', type: 'TEXT' },
  { name: 'budget', type: 'REAL' },
  { name: 'urgency', type: 'TEXT' },
  { name: 'contact_method', type: 'TEXT' },
  { name: 'images', type: 'TEXT' }, // JSON array of image URLs
];

// First, let's check the current table structure
db.all("PRAGMA table_info(marketplace_service_cases)", (err, rows) => {
  if (err) {
    console.error('❌ Error getting table info:', err.message);
    db.close();
    return;
  }
  
  console.log('\n📊 Current marketplace_service_cases table structure:');
  const existingColumns = [];
  rows.forEach(row => {
    console.log(`  - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
    existingColumns.push(row.name);
  });
  
  // Check which columns are missing
  const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col.name));
  
  if (missingColumns.length === 0) {
    console.log('\n✅ All required columns already exist!');
    db.close();
    return;
  }
  
  console.log('\n🔧 Missing columns to add:');
  missingColumns.forEach(col => {
    console.log(`  - ${col.name}: ${col.type}`);
  });
  
  // Add missing columns one by one
  let completed = 0;
  const addColumn = (column) => {
    const sql = `ALTER TABLE marketplace_service_cases ADD COLUMN ${column.name} ${column.type}`;
    console.log(`\n🔧 Adding column: ${column.name}...`);
    
    db.run(sql, (err) => {
      if (err) {
        console.error(`❌ Error adding ${column.name} column:`, err.message);
      } else {
        console.log(`✅ Successfully added ${column.name} column`);
      }
      
      completed++;
      if (completed === missingColumns.length) {
        // All columns added, verify the final structure
        console.log('\n🔍 Verifying final table structure...');
        db.all("PRAGMA table_info(marketplace_service_cases)", (err, rows) => {
          if (err) {
            console.error('❌ Error verifying table structure:', err.message);
          } else {
            console.log('\n📊 Final marketplace_service_cases table structure:');
            rows.forEach(row => {
              console.log(`  - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
            });
            
            // Check if all required columns now exist
            const finalColumns = rows.map(row => row.name);
            const stillMissing = requiredColumns.filter(col => !finalColumns.includes(col.name));
            
            if (stillMissing.length === 0) {
              console.log('\n🎉 All required columns successfully added!');
              console.log('💡 Backend server should now be able to create cases properly.');
            } else {
              console.log('\n❌ Some columns are still missing:');
              stillMissing.forEach(col => console.log(`  - ${col.name}`));
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
      }
    });
  };
  
  // Add all missing columns
  missingColumns.forEach(addColumn);
});
