const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'servicetext_pro.db');

console.log('📱 Creating SMS settings table for synchronization');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database\n');
});

// Create SMS settings table matching mobile app SMSConfig interface
// SMS is OFF by default - users must explicitly enable it
const createTableSQL = `
  CREATE TABLE IF NOT EXISTS sms_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    is_enabled INTEGER DEFAULT 0,
    message_template TEXT DEFAULT 'Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]\n\n',
    last_sent_time INTEGER,
    sent_count INTEGER DEFAULT 0,
    sent_call_ids TEXT DEFAULT '[]',
    filter_known_contacts INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

db.run(createTableSQL, (err) => {
  if (err) {
    console.error('❌ Error creating sms_settings table:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('✅ Created sms_settings table');

  // Create index for faster lookups
  db.run('CREATE INDEX IF NOT EXISTS idx_sms_settings_user_id ON sms_settings(user_id)', (err) => {
    if (err) {
      console.error('❌ Error creating index:', err.message);
    } else {
      console.log('✅ Created index on user_id');
    }

    // Verify table structure
    db.all("PRAGMA table_info(sms_settings)", (err, columns) => {
      if (err) {
        console.error('❌ Error verifying table:', err.message);
      } else {
        console.log('\n📊 SMS Settings table structure:');
        columns.forEach((col, index) => {
          console.log(`${index + 1}. ${col.name.padEnd(25)} ${col.type.padEnd(10)} ${col.notnull ? 'NOT NULL' : 'NULLABLE'} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
        });
      }

      db.close(() => {
        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 SMS settings will now be:');
        console.log('   ✓ Stored in database per user');
        console.log('   ✓ Synchronized between mobile app and web app');
        console.log('   ✓ Persisted across sessions');
        console.log('   ✓ Protected by user authentication');
      });
    });
  });
});
