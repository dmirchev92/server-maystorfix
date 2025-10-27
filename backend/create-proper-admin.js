// Create Admin User with Proper BCrypt Hashing
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

async function createProperAdmin() {
  console.log('👑 Creating admin user with proper BCrypt hashing...');
  
  const db = new sqlite3.Database(dbPath);
  
  try {
    // 1. Create users table if it doesn't exist (matching your AuthService structure)
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          passwordHash TEXT NOT NULL,
          firstName TEXT NOT NULL,
          lastName TEXT NOT NULL,
          phoneNumber TEXT,
          role TEXT DEFAULT 'user',
          status TEXT DEFAULT 'active',
          businessId TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastLoginAt DATETIME,
          isGdprCompliant BOOLEAN DEFAULT 0,
          dataRetentionUntil DATETIME,
          gdprConsents TEXT DEFAULT '[]'
        )
      `, function(err) {
        if (err) reject(err);
        else {
          console.log('✅ Users table ready');
          resolve();
        }
      });
    });

    // 2. Hash password with BCrypt (same as AuthService)
    const password = 'Admin123!';
    const bcryptRounds = 12; // Same as config
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    
    console.log('🔐 Password hashed with BCrypt (rounds: 12)');

    // 3. Create admin user
    const adminId = 'admin-' + Date.now();
    
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO users (
          id, email, passwordHash, firstName, lastName, 
          role, status, isGdprCompliant, 
          createdAt, updatedAt, dataRetentionUntil, gdprConsents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        adminId,
        'admin@servicetextpro.com',
        passwordHash,
        'System',
        'Administrator',
        'admin',
        'active',
        1, // isGdprCompliant
        new Date().toISOString(),
        new Date().toISOString(),
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year retention
        JSON.stringify([]) // Empty GDPR consents array
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Admin user created successfully!');
          console.log('   ID:', adminId);
          console.log('   Email: admin@servicetextpro.com');
          console.log('   Password: Admin123!');
          console.log('   Role: admin');
          console.log('   Status: active');
          console.log('   GDPR Compliant: Yes');
          resolve();
        }
      });
    });

    console.log('');
    console.log('🎉 Admin setup complete!');
    console.log('');
    console.log('📋 LOGIN CREDENTIALS:');
    console.log('   📧 Email: admin@servicetextpro.com');
    console.log('   🔑 Password: Admin123!');
    console.log('   👑 Role: admin');
    console.log('');
    console.log('🔗 ACCESS LINKS:');
    console.log('   🔐 Login: http://192.168.0.129:3002/auth/login');
    console.log('   👑 Admin Panel: http://192.168.0.129:3002/admin');
    console.log('   🛡️ SMS Security: http://192.168.0.129:3002/settings/sms');
    console.log('');
    console.log('✅ Ready to test SMS security system!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    db.close();
  }
}

createProperAdmin().catch(console.error);
