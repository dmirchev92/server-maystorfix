// Compare Both Databases in Data Folder
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function compareDatabases() {
  console.log('🔍 Comparing both databases in data folder...\n');

  const databases = [
    { 
      name: 'servicetext_pro.db (MAIN)', 
      path: path.join(__dirname, 'data', 'servicetext_pro.db'),
      size: '507,904 bytes'
    },
    { 
      name: 'servicetext.db (SECONDARY)', 
      path: path.join(__dirname, 'data', 'servicetext.db'),
      size: '40,960 bytes'
    }
  ];

  for (const dbInfo of databases) {
    console.log(`\n📁 DATABASE: ${dbInfo.name}`);
    console.log(`   Path: ${dbInfo.path}`);
    console.log(`   Size: ${dbInfo.size}`);
    console.log('   ' + '='.repeat(50));
    
    try {
      const db = new sqlite3.Database(dbInfo.path);
      
      // Get all tables
      const tables = await new Promise((resolve, reject) => {
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.name));
        });
      });
      
      console.log(`   📋 TABLES (${tables.length}):`);
      for (const table of tables) {
        // Get row count for each table
        const count = await new Promise((resolve, reject) => {
          db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        });
        
        console.log(`      - ${table}: ${count} rows`);
      }
      
      // Special checks for important tables
      if (tables.includes('users')) {
        console.log('\n   👥 USERS ANALYSIS:');
        
        const users = await new Promise((resolve, reject) => {
          db.all("SELECT email, role, status FROM users LIMIT 5", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        
        users.forEach(user => {
          console.log(`      - ${user.email} (${user.role}) [${user.status || 'no status'}]`);
        });
        
        if (users.length === 5) {
          console.log('      ... (showing first 5 users)');
        }
        
        // Check for admin users
        const adminCount = await new Promise((resolve, reject) => {
          db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        });
        
        console.log(`      👑 Admin users: ${adminCount}`);
      }
      
      // Check for SMS-related data
      const smsTable = tables.find(t => t.includes('sms') || t.includes('activity'));
      if (smsTable) {
        console.log(`\n   📱 SMS DATA (${smsTable}):`);
        
        const recentSms = await new Promise((resolve, reject) => {
          db.all(`SELECT * FROM ${smsTable} ORDER BY timestamp DESC LIMIT 3`, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        
        recentSms.forEach((sms, i) => {
          console.log(`      ${i+1}. ${sms.phone_number || 'N/A'} - ${sms.success ? 'SUCCESS' : 'BLOCKED'} (${sms.timestamp || 'no time'})`);
        });
      }
      
      // Check for marketplace/business data
      const businessTables = tables.filter(t => 
        t.includes('marketplace') || 
        t.includes('provider') || 
        t.includes('service') || 
        t.includes('referral')
      );
      
      if (businessTables.length > 0) {
        console.log(`\n   🏪 BUSINESS/MARKETPLACE DATA:`);
        businessTables.forEach(table => {
          console.log(`      - ${table}`);
        });
      }
      
      db.close();
      
    } catch (error) {
      console.log(`   ❌ Error reading database: ${error.message}`);
    }
  }
  
  console.log('\n\n📋 ANALYSIS SUMMARY:');
  console.log('='.repeat(60));
  console.log('🤔 WHY TWO DATABASES?');
  console.log('   Possible reasons:');
  console.log('   1. Different parts of the app use different databases');
  console.log('   2. One is for main app, one is for marketplace/business features');
  console.log('   3. Legacy setup - one might be old/unused');
  console.log('   4. Backup or migration artifact');
  console.log('\n💡 RECOMMENDATION:');
  console.log('   - Check which database your AuthService actually uses');
  console.log('   - Check which database has your admin user');
  console.log('   - Consider consolidating if both contain important data');
}

compareDatabases().catch(console.error);
