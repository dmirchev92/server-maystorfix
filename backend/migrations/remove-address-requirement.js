const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'servicetext_pro.db');

console.log('🔧 Removing address requirement from marketplace_service_cases table');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// SQLite doesn't support ALTER COLUMN, so we need to recreate the table
console.log('\n🔄 Recreating table without address NOT NULL constraint...');

db.serialize(() => {
  // Step 1: Get current table structure
  db.all("PRAGMA table_info(marketplace_service_cases)", (err, columns) => {
    if (err) {
      console.error('❌ Error getting table info:', err.message);
      db.close();
      return;
    }

    console.log('\n📊 Current table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
    });

    // Step 2: Drop existing new table if it exists
    db.run('DROP TABLE IF EXISTS marketplace_service_cases_new', (err) => {
      if (err) {
        console.error('❌ Error dropping old new table:', err.message);
        db.close();
        return;
      }
      console.log('✅ Cleaned up any existing temp table');

      // Step 3: Create new table with address as nullable (matching exact column order from existing table)
      db.run(`
        CREATE TABLE marketplace_service_cases_new (
        id TEXT,
        service_type TEXT NOT NULL,
        description TEXT NOT NULL,
        preferred_date TEXT,
        preferred_time TEXT DEFAULT 'morning',
        priority TEXT DEFAULT 'normal',
        address TEXT,
        phone TEXT NOT NULL,
        additional_details TEXT,
        provider_id TEXT,
        provider_name TEXT,
        is_open_case INTEGER DEFAULT 0,
        assignment_type TEXT DEFAULT 'open',
        status TEXT DEFAULT 'pending',
        decline_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        completion_notes TEXT,
        customer_id TEXT,
        category TEXT,
        contact_method TEXT,
        images TEXT,
        urgency TEXT,
        location TEXT,
        budget REAL,
        city TEXT,
        neighborhood TEXT
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating new table:', err.message);
        db.close();
        return;
      }
      console.log('✅ Created new table structure');

      // Step 3: Copy data from old table to new table (explicitly list all columns)
      db.run(`
        INSERT INTO marketplace_service_cases_new (
          id, service_type, description, preferred_date, preferred_time,
          priority, address, phone, additional_details, provider_id,
          provider_name, is_open_case, assignment_type, status, decline_reason,
          created_at, updated_at, completed_at, completion_notes, customer_id,
          category, contact_method, images, urgency, location, budget, city, neighborhood
        )
        SELECT 
          id, service_type, description, preferred_date, preferred_time,
          priority, address, phone, additional_details, provider_id,
          provider_name, is_open_case, assignment_type, status, decline_reason,
          created_at, updated_at, completed_at, completion_notes, customer_id,
          category, contact_method, images, urgency, location, budget, city, neighborhood
        FROM marketplace_service_cases
      `, (err) => {
        if (err) {
          console.error('❌ Error copying data:', err.message);
          db.close();
          return;
        }
        console.log('✅ Copied all data to new table');

        // Step 4: Drop old table
        db.run('DROP TABLE marketplace_service_cases', (err) => {
          if (err) {
            console.error('❌ Error dropping old table:', err.message);
            db.close();
            return;
          }
          console.log('✅ Dropped old table');

          // Step 5: Rename new table to original name
          db.run('ALTER TABLE marketplace_service_cases_new RENAME TO marketplace_service_cases', (err) => {
            if (err) {
              console.error('❌ Error renaming table:', err.message);
              db.close();
              return;
            }
            console.log('✅ Renamed new table to marketplace_service_cases');

            // Step 6: Verify final structure
            db.all("PRAGMA table_info(marketplace_service_cases)", (err, columns) => {
              if (err) {
                console.error('❌ Error verifying table:', err.message);
              } else {
                console.log('\n📊 Final table structure:');
                columns.forEach(col => {
                  console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
                });
              }

              db.close(() => {
                console.log('\n✅ Migration completed successfully!');
                console.log('📝 Address column is now nullable (optional)');
                console.log('📝 City and neighborhood columns are available');
              });
            });
          });
        });
      });
    });
  });
});
});
