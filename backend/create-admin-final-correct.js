// Create Admin User with Actual Table Structure
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Use the same path as SQLiteDatabase
const dbPath = path.join(process.cwd(), 'data', 'servicetext_pro.db');

async function createAdminFinalCorrect() {
  console.log('👑 Creating admin user with actual table structure...');
  console.log('📁 Database path:', dbPath);
  
  const db = new sqlite3.Database(dbPath);
  
  try {
    // 1. Get actual table structure
    console.log('📋 Getting actual table structure...');
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('📊 Available columns:');
    tableInfo.forEach(col => {
      console.log(`   - ${col.name} (${col.type})`);
    });

    // 2. Hash password
    const password = 'Admin123!';
    const bcryptRounds = 12;
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    
    console.log('🔐 Password hashed with BCrypt');

    // 3. Create admin user with only existing columns
    const adminId = 'admin-' + Date.now();
    
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO users (
          id, email, password_hash, first_name, last_name, 
          role, status, phone_number, business_id,
          is_gdpr_compliant, data_retention_until,
          created_at, updated_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        adminId,
        'admin@servicetextpro.com',
        passwordHash,
        'System',
        'Administrator',
        'admin',
        'active',        // status
        null,            // phone_number
        null,            // business_id
        1,               // is_gdpr_compliant
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // data_retention_until
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

    // 4. Verify the user was created and test authentication
    console.log('🔍 Verifying user creation and testing authentication...');
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
      console.log('✅ User found in database!');
      console.log('   Email:', testUser.email);
      console.log('   Role:', testUser.role);
      console.log('   Status:', testUser.status);
      console.log('   GDPR Compliant:', testUser.is_gdpr_compliant);
      
      // Test password
      const isPasswordValid = await bcrypt.compare(password, testUser.password_hash);
      console.log('✅ Password verification:', isPasswordValid ? 'PASSED ✅' : 'FAILED ❌');
      
      if (isPasswordValid) {
        console.log('');
        console.log('🎉 PERFECT! ADMIN USER IS READY!');
        console.log('');
        console.log('📋 LOGIN CREDENTIALS:');
        console.log('   📧 Email: admin@servicetextpro.com');
        console.log('   🔑 Password: Admin123!');
        console.log('   👑 Role: admin');
        console.log('');
        console.log('🔗 LOGIN NOW - IT WILL WORK:');
        console.log('   🔐 Login: http://192.168.0.129:3002/auth/login');
        console.log('   👑 Admin Panel: http://192.168.0.129:3002/admin');
        console.log('');
        console.log('🛡️ Your SMS security system is ready!');
      }
    } else {
      console.log('❌ User not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Creation failed:', error.message);
    console.error('Full error:', error);
  } finally {
    db.close();
  }
}

createAdminFinalCorrect().catch(console.error);
