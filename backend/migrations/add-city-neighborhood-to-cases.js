const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'servicetext_pro.db');

console.log('🔧 Adding city and neighborhood columns to case tables');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Tables that need city and neighborhood columns
const tablesToUpdate = [
  'marketplace_service_cases',  // Direct case creation (used by UnifiedCaseModal)
  'service_cases'                // Template-based cases (used by chat templates)
];

let completedTables = 0;

tablesToUpdate.forEach((tableName) => {
  console.log(`\n📋 Checking table: ${tableName}`);
  
  db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
    if (err) {
      console.error(`❌ Error getting table info for ${tableName}:`, err.message);
      completedTables++;
      if (completedTables === tablesToUpdate.length) {
        db.close();
      }
      return;
    }
    
    console.log(`📊 Current ${tableName} structure:`);
    rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
    });
    
    // Check if columns already exist
    const hasCity = rows.some(row => row.name === 'city');
    const hasNeighborhood = rows.some(row => row.name === 'neighborhood');
    
    if (hasCity && hasNeighborhood) {
      console.log(`✅ ${tableName}: Columns already exist, skipping`);
      completedTables++;
      if (completedTables === tablesToUpdate.length) {
        db.close(() => {
          console.log('\n✅ Migration completed successfully');
        });
      }
      return;
    }
    
    console.log(`🔧 ${tableName}: Adding missing columns...`);
    
    let columnsAdded = 0;
    const columnsToAdd = [];
    
    if (!hasCity) columnsToAdd.push('city');
    if (!hasNeighborhood) columnsToAdd.push('neighborhood');
    
    // Add city column if it doesn't exist
    if (!hasCity) {
      db.run(`ALTER TABLE ${tableName} ADD COLUMN city TEXT`, (err) => {
        if (err) {
          console.error(`❌ Error adding city column to ${tableName}:`, err.message);
        } else {
          console.log(`✅ ${tableName}: Added city column`);
        }
        columnsAdded++;
        checkCompletion();
      });
    }
    
    // Add neighborhood column if it doesn't exist
    if (!hasNeighborhood) {
      db.run(`ALTER TABLE ${tableName} ADD COLUMN neighborhood TEXT`, (err) => {
        if (err) {
          console.error(`❌ Error adding neighborhood column to ${tableName}:`, err.message);
        } else {
          console.log(`✅ ${tableName}: Added neighborhood column`);
        }
        columnsAdded++;
        checkCompletion();
      });
    }
    
    function checkCompletion() {
      if (columnsAdded === columnsToAdd.length) {
        // Verify the columns were added
        db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
          if (err) {
            console.error(`❌ Error verifying ${tableName} structure:`, err.message);
          } else {
            console.log(`\n📊 Updated ${tableName} structure:`);
            rows.forEach(row => {
              console.log(`  - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
            });
          }
          
          completedTables++;
          if (completedTables === tablesToUpdate.length) {
            db.close(() => {
              console.log('\n✅ Migration completed successfully for all tables');
            });
          }
        });
      }
    }
  });
});
