/**
 * Migration: Add case_declines table to track which providers declined which cases
 * 
 * This allows cases to remain available for other providers even after one declines
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path from user's global rules
const DB_PATH = path.join(__dirname, '..', 'data', 'servicetext_pro.db');

console.log('🚫 Creating case_declines table...');
console.log('📂 Database path:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Create case_declines table
const createTableSQL = `
  CREATE TABLE IF NOT EXISTS case_declines (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    reason TEXT,
    declined_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES marketplace_service_cases(id),
    FOREIGN KEY (provider_id) REFERENCES users(id),
    UNIQUE(case_id, provider_id)
  )
`;

// Create indexes for better query performance
const createIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_case_declines_case ON case_declines(case_id)',
  'CREATE INDEX IF NOT EXISTS idx_case_declines_provider ON case_declines(provider_id)',
  'CREATE INDEX IF NOT EXISTS idx_case_declines_case_provider ON case_declines(case_id, provider_id)'
];

// Execute migration
db.serialize(() => {
  // Create table
  db.run(createTableSQL, (err) => {
    if (err) {
      console.error('❌ Error creating case_declines table:', err);
      process.exit(1);
    }
    console.log('✅ case_declines table created successfully');
  });

  // Create indexes
  createIndexes.forEach((indexSQL, idx) => {
    db.run(indexSQL, (err) => {
      if (err) {
        console.error(`❌ Error creating index ${idx + 1}:`, err);
      } else {
        console.log(`✅ Index ${idx + 1} created successfully`);
      }
    });
  });

  // Verify table structure
  db.all("PRAGMA table_info(case_declines)", (err, columns) => {
    if (err) {
      console.error('❌ Error verifying table:', err);
    } else {
      console.log('\n📋 Table structure:');
      columns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
      });
    }

    // Close database
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
      } else {
        console.log('\n✅ Migration completed successfully!');
        console.log('🚫 Service Providers can now decline cases without affecting other providers.');
      }
    });
  });
});
