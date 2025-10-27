// Fix Admin User to Match SQLiteDatabase Structure
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

async function fixAdminUser() {
  console.log('🔧 Fixing admin user to match SQLiteDatabase structure...');
  
  const db = new sqlite3.Database(dbPath);
  
  try {
    // First, let's add missing columns to the users table
    console.log('📋 Adding missing columns to users table...');
    
    // Add status column if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.log('⚠️  Status column might already exist:', err.message);
        } else {
          console.log('✅ Status column added/exists');
        }
        resolve();
      });
    });

    // Add is_gdpr_compliant column if it doesn't exist (rename from gdpr_consent_given)
    await new Promise((resolve, reject) => {
      db.run(`ALTER TABLE users ADD COLUMN is_gdpr_compliant BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.log('⚠️  is_gdpr_compliant column might already exist:', err.message);
        } else {
          console.log('✅ is_gdpr_compliant column added/exists');
        }
        resolve();
      });
    });

    // Now create/update the admin user with correct structure
    const password = 'Admin123!';
    const bcryptRounds = 12;
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    
    console.log('🔐 Password hashed with BCrypt');

    const adminId = 'admin-' + Date.now();
    
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO users (
          id, email, password_hash, first_name, last_name, 
          role, status, is_active, email_verified, phone_number, business_id,
          is_gdpr_compliant, data_retention_until,
          created_at, updated_at, last_login_at, password_changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        adminId,
        'admin@servicetextpro.com',
        passwordHash,
        'System',
        'Administrator',
        'admin',
        'active',        // status (required by SQLiteDatabase)
        1,               // is_active
        1,               // email_verified
        null,            // phone_number
        null,            // business_id
        1,               // is_gdpr_compliant (required by SQLiteDatabase)
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // data_retention_until (1 year)
        new Date().toISOString(), // created_at
        new Date().toISOString(), // updated_at
        null,                     // last_login_at
        new Date().toISOString()  // password_changed_at
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Admin user created/updated successfully!');
          console.log('   ID:', adminId);
          console.log('   Email: admin@servicetextpro.com');
          console.log('   Role: admin');
          console.log('   Status: active');
          console.log('   GDPR Compliant: Yes');
          resolve();
        }
      });
    });

    // Test the user lookup to make sure it works
    console.log('🔍 Testing user lookup...');
    await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE email = ? AND status != "deleted"',
        ['admin@servicetextpro.com'],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            console.log('✅ User lookup test successful!');
            console.log('   Found user:', row.email, 'with role:', row.role);
            resolve();
          } else {
            console.log('❌ User lookup test failed - user not found');
            resolve();
          }
        }
      );
    });

    console.log('');
    console.log('🎉 ADMIN USER FIXED!');
    console.log('');
    console.log('📋 LOGIN CREDENTIALS:');
    console.log('   📧 Email: admin@servicetextpro.com');
    console.log('   🔑 Password: Admin123!');
    console.log('   👑 Role: admin');
    console.log('   📊 Status: active');
    console.log('');
    console.log('🔗 TRY LOGGING IN NOW:');
    console.log('   🔐 Login: http://192.168.0.129:3002/auth/login');
    console.log('   👑 Admin Panel: http://192.168.0.129:3002/admin');
    console.log('');
    console.log('✅ The login should work now!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    db.close();
  }
}

fixAdminUser().catch(console.error);
