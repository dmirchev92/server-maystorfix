/**
 * Migration: Add case_income table for tracking Service Provider income
 * 
 * This table stores income data when cases are completed, allowing SPs
 * to track their earnings over time.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path from user's global rules
const DB_PATH = path.join(__dirname, '..', 'data', 'servicetext_pro.db');

console.log('📊 Starting case_income table migration...');
console.log('📂 Database path:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Create case_income table
const createTableSQL = `
  CREATE TABLE IF NOT EXISTS case_income (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    customer_id TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'BGN',
    payment_method TEXT,
    notes TEXT,
    recorded_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES marketplace_service_cases(id),
    FOREIGN KEY (provider_id) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES users(id)
  )
`;

// Create indexes for better query performance
const createIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_case_income_provider ON case_income(provider_id)',
  'CREATE INDEX IF NOT EXISTS idx_case_income_case ON case_income(case_id)',
  'CREATE INDEX IF NOT EXISTS idx_case_income_recorded_at ON case_income(recorded_at)',
  'CREATE INDEX IF NOT EXISTS idx_case_income_provider_date ON case_income(provider_id, recorded_at)'
];

// Execute migration
db.serialize(() => {
  // Create table
  db.run(createTableSQL, (err) => {
    if (err) {
      console.error('❌ Error creating case_income table:', err);
      process.exit(1);
    }
    console.log('✅ case_income table created successfully');
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
  db.all("PRAGMA table_info(case_income)", (err, columns) => {
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
        console.log('💰 Service Providers can now track their income from completed cases.');
      }
    });
  });
});
