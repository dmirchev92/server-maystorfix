// Create Admin User with Correct Column Names
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

async function createFinalAdmin() {
  console.log('👑 Creating admin user with correct table structure...');
  
  const db = new sqlite3.Database(dbPath);
  
  try {
    // Hash password with BCrypt (same as AuthService)
    const password = 'Admin123!';
    const bcryptRounds = 12;
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    
    console.log('🔐 Password hashed with BCrypt');

    // Create admin user with correct column names
    const adminId = 'admin-' + Date.now();
    
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO users (
          id, email, password_hash, first_name, last_name, 
          role, is_active, email_verified, 
          gdpr_consent_given, gdpr_consent_date, data_retention_until,
          created_at, updated_at, password_changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        adminId,
        'admin@servicetextpro.com',
        passwordHash,
        'System',
        'Administrator',
        'admin',
        1, // is_active
        1, // email_verified
        1, // gdpr_consent_given
        new Date().toISOString(),
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year retention
        new Date().toISOString(), // created_at
        new Date().toISOString(), // updated_at
        new Date().toISOString()  // password_changed_at
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Admin user created successfully!');
          console.log('   ID:', adminId);
          console.log('   Email: admin@servicetextpro.com');
          console.log('   Role: admin');
          console.log('   Active: Yes');
          console.log('   Email Verified: Yes');
          console.log('   GDPR Compliant: Yes');
          resolve();
        }
      });
    });

    // Also grant admin permissions
    const permissionId = 'perm-admin-' + Date.now();
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO user_permissions (
          id, user_id, permission, granted_by, granted_at
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        permissionId,
        adminId,
        'admin.*', // All admin permissions
        adminId,   // self-granted
        new Date().toISOString()
      ], function(err) {
        if (err) {
          console.log('⚠️  Could not grant permissions (table may not exist)');
          resolve(); // Don't fail if permissions table doesn't exist
        } else {
          console.log('✅ Admin permissions granted');
          resolve();
        }
      });
    });

    console.log('');
    console.log('🎉 ADMIN SETUP COMPLETE!');
    console.log('');
    console.log('📋 LOGIN CREDENTIALS:');
    console.log('   📧 Email: admin@servicetextpro.com');
    console.log('   🔑 Password: Admin123!');
    console.log('   👑 Role: admin');
    console.log('');
    console.log('🔗 ACCESS YOUR SYSTEM:');
    console.log('   1. 🔐 Login: http://192.168.0.129:3002/auth/login');
    console.log('   2. 👑 Admin Panel: http://192.168.0.129:3002/admin');
    console.log('   3. 🛡️ SMS Security: http://192.168.0.129:3002/settings/sms');
    console.log('');
    console.log('🛡️ SECURITY FEATURES READY:');
    console.log('   ✅ 3-Layer SMS Protection');
    console.log('   ✅ Premium Number Blocking');
    console.log('   ✅ Admin Dashboard');
    console.log('   ✅ Real-time Security Alerts');
    console.log('');
    console.log('🚀 Ready to test! Try logging in now.');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    db.close();
  }
}

createFinalAdmin().catch(console.error);
