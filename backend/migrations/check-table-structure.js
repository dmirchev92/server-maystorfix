const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'servicetext_pro.db');

console.log('📋 Checking marketplace_service_cases table structure');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database\n');
});

db.all("PRAGMA table_info(marketplace_service_cases)", (err, columns) => {
  if (err) {
    console.error('❌ Error getting table info:', err.message);
    db.close();
    return;
  }

  console.log('📊 Current marketplace_service_cases columns:\n');
  columns.forEach((col, index) => {
    console.log(`${index + 1}. ${col.name.padEnd(25)} ${col.type.padEnd(10)} ${col.notnull ? 'NOT NULL' : 'NULLABLE'} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
  });

  console.log(`\n📈 Total columns: ${columns.length}`);

  db.close(() => {
    console.log('\n✅ Done');
  });
});
