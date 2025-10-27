// Create Admin User Script
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function createAdminUser() {
  try {
    console.log('🔧 Creating admin user...');
    
    // Simple hash for demo (in production, use proper bcrypt)
    const hashedPassword = crypto.createHash('sha256').update('Admin').digest('hex');
    
    // Create admin user
    const adminId = 'admin-user-id-12345';
    
    db.run(`
      INSERT OR REPLACE INTO users (
        id, email, password_hash, first_name, last_name, 
        role, is_active, email_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      adminId,
      'admin@servicetextpro.com',
      hashedPassword,
      'Admin',
      'User',
      'admin',
      1,
      1,
      new Date().toISOString(),
      new Date().toISOString()
    ], function(err) {
      if (err) {
        console.error('❌ Error creating admin user:', err);
      } else {
        console.log('✅ Admin user created successfully!');
        console.log('📧 Email: admin@servicetextpro.com');
        console.log('🔑 Password: Admin');
        console.log('👑 Role: admin');
        console.log('🆔 User ID:', adminId);
      }
      
      db.close();
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    db.close();
  }
}

createAdminUser();
