const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔄 Starting case status migration...');
console.log('📁 Database path:', dbPath);

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Migration function
function migrateCaseStatus() {
  return new Promise((resolve, reject) => {
    // First, check how many cases have 'closed' status
    db.get(
      "SELECT COUNT(*) as count FROM marketplace_service_cases WHERE status = 'closed'",
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        const closedCount = row.count;
        console.log(`📊 Found ${closedCount} cases with 'closed' status`);
        
        if (closedCount === 0) {
          console.log('✅ No cases need migration');
          resolve();
          return;
        }
        
        // Update closed cases to completed
        db.run(
          "UPDATE marketplace_service_cases SET status = 'completed' WHERE status = 'closed'",
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            
            console.log(`✅ Successfully updated ${this.changes} cases from 'closed' to 'completed'`);
            resolve();
          }
        );
      }
    );
  });
}

// Run migration
migrateCaseStatus()
  .then(() => {
    console.log('🎉 Case status migration completed successfully!');
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('✅ Database connection closed');
      }
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    db.close();
    process.exit(1);
  });
