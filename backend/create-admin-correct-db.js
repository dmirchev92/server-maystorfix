// Create Admin User in Correct Database (data/servicetext_pro.db)
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Use the same path as SQLiteDatabase
const dbPath = path.join(process.cwd(), 'data', 'servicetext_pro.db');

async function createAdminInCorrectDB() {
  console.log('👑 Creating admin user in correct database...');
  console.log('📁 Database path:', dbPath);
  
  const db = new sqlite3.Database(dbPath);
  
  try {
    // 1. Check current table structure
    console.log('📋 Checking table structure...');
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('📊 Users table columns:', tableInfo.map(col => col.name).join(', '));

    // 2. Hash password with BCrypt
    const password = 'Admin123!';
    const bcryptRounds = 12;
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    
    console.log('🔐 Password hashed with BCrypt');

    // 3. Create admin user
    const adminId = 'admin-' + Date.now();
    
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO users (
          id, email, password_hash, first_name, last_name, 
          role, status, is_active, email_verified, phone_number, business_id,
          is_gdpr_compliant, data_retention_until,
          created_at, updated_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        null                      // last_login_at
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Admin user created successfully!');
          console.log('   ID:', adminId);
          console.log('   Email: admin@servicetextpro.com');
          console.log('   Role: admin');
          console.log('   Status: active');
          resolve();
        }
      });
    });

    // 4. Test authentication query
    console.log('🔍 Testing authentication query...');
    const testUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE email = ? AND status != "deleted"',
        ['admin@servicetextpro.com'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (testUser) {
      console.log('✅ Authentication query successful!');
      
      // Test password
      const isPasswordValid = await bcrypt.compare(password, testUser.password_hash);
      console.log('✅ Password verification:', isPasswordValid ? 'PASSED' : 'FAILED');
    } else {
      console.log('❌ Authentication query failed');
    }

    console.log('');
    console.log('🎉 ADMIN USER CREATED IN CORRECT DATABASE!');
    console.log('');
    console.log('📋 LOGIN CREDENTIALS:');
    console.log('   📧 Email: admin@servicetextpro.com');
    console.log('   🔑 Password: Admin123!');
    console.log('   👑 Role: admin');
    console.log('');
    console.log('🔗 LOGIN NOW:');
    console.log('   🔐 Login: http://192.168.0.129:3002/auth/login');
    console.log('   👑 Admin Panel: http://192.168.0.129:3002/admin');
    console.log('');
    console.log('✅ This should definitely work now!');
    
  } catch (error) {
    console.error('❌ Creation failed:', error.message);
  } finally {
    db.close();
  }
}

createAdminInCorrectDB().catch(console.error);
