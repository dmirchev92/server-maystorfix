// Check All Database Files for Misplaced Data
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function checkAllDatabases() {
  console.log('🔍 Checking all database files for misplaced data...\n');

  const databases = [
    { name: 'database.sqlite', path: path.join(__dirname, 'database.sqlite') },
    { name: 'servicetext_pro.db (correct)', path: path.join(__dirname, 'data', 'servicetext_pro.db') },
    { name: 'servicetext.db', path: path.join(__dirname, 'data', 'servicetext.db') },
    { name: 'servicetext_pro.db (root)', path: path.join(__dirname, 'servicetext_pro.db') }
  ];

  for (const dbInfo of databases) {
    console.log(`\n📁 Checking: ${dbInfo.name}`);
    console.log(`   Path: ${dbInfo.path}`);
    
    if (!fs.existsSync(dbInfo.path)) {
      console.log('   ❌ File does not exist');
      continue;
    }

    const stats = fs.statSync(dbInfo.path);
    console.log(`   📊 Size: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      console.log('   ⚠️  Empty file');
      continue;
    }

    try {
      const db = new sqlite3.Database(dbInfo.path);
      
      // Get all tables
      const tables = await new Promise((resolve, reject) => {
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.name));
        });
      });
      
      console.log(`   📋 Tables (${tables.length}):`, tables.join(', '));
      
      // Check for users table specifically
      if (tables.includes('users')) {
        const userCount = await new Promise((resolve, reject) => {
          db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        });
        
        console.log(`   👥 Users: ${userCount}`);
        
        // Check for admin users
        const adminUsers = await new Promise((resolve, reject) => {
          db.all("SELECT email, role FROM users WHERE role = 'admin'", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        
        if (adminUsers.length > 0) {
          console.log('   👑 Admin users:');
          adminUsers.forEach(user => {
            console.log(`      - ${user.email} (${user.role})`);
          });
        }
      }
      
      // Check for SMS-related tables
      const smsTable = tables.find(t => t.includes('sms') || t.includes('activity'));
      if (smsTable) {
        const smsCount = await new Promise((resolve, reject) => {
          db.get(`SELECT COUNT(*) as count FROM ${smsTable}`, (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        });
        console.log(`   📱 SMS records in ${smsTable}: ${smsCount}`);
      }
      
      // Check for roles/permissions tables
      if (tables.includes('roles')) {
        const roleCount = await new Promise((resolve, reject) => {
          db.get("SELECT COUNT(*) as count FROM roles", (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        });
        console.log(`   🔐 Roles: ${roleCount}`);
      }
      
      if (tables.includes('user_permissions')) {
        const permCount = await new Promise((resolve, reject) => {
          db.get("SELECT COUNT(*) as count FROM user_permissions", (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        });
        console.log(`   🔑 Permissions: ${permCount}`);
      }
      
      db.close();
      
    } catch (error) {
      console.log(`   ❌ Error reading database: ${error.message}`);
    }
  }
  
  console.log('\n📋 SUMMARY:');
  console.log('===================');
  console.log('✅ CORRECT DATABASE: data/servicetext_pro.db (used by AuthService)');
  console.log('❌ WRONG DATABASES: Any other .db/.sqlite files with important data');
  console.log('\n💡 RECOMMENDATION:');
  console.log('- Keep admin user in data/servicetext_pro.db (already done)');
  console.log('- Move any important data from other databases to the correct one');
  console.log('- Delete or ignore empty/unused database files');
}

checkAllDatabases().catch(console.error);
