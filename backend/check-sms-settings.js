const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');
const db = new sqlite3.Database(dbPath);

const email = 'mirchev92@yahoo.com';

console.log('\n🔍 Checking SMS settings for:', email);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check all tables
db.all(`SELECT name FROM sqlite_master WHERE type='table'`, (err, tables) => {
  if (err) {
    console.error('❌ Error:', err.message);
    db.close();
    return;
  }

  console.log('📋 All tables in database:');
  const smsRelated = [];
  tables.forEach(t => {
    console.log('   -', t.name);
    if (t.name.toLowerCase().includes('sms') || t.name.toLowerCase().includes('setting')) {
      smsRelated.push(t.name);
    }
  });

  console.log('\n📱 SMS/Settings related tables:', smsRelated.length > 0 ? smsRelated.join(', ') : 'None found');

  // Check user data
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err2, user) => {
    if (err2) {
      console.error('❌ Error:', err2.message);
      db.close();
      return;
    }

    if (!user) {
      console.log('\n❌ User not found');
      db.close();
      return;
    }

    console.log('\n👤 User found:', user.id);
    console.log('\n📊 User columns and values:');
    Object.keys(user).forEach(key => {
      if (key.toLowerCase().includes('sms') || key.toLowerCase().includes('auto') || key.toLowerCase().includes('template')) {
        console.log(`   ✓ ${key}:`, user[key]);
      }
    });

    // Check if there's a user_settings table
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'`, (err3, settingsTable) => {
      if (settingsTable) {
        console.log('\n⚙️ Found user_settings table, checking...');
        db.get(`SELECT * FROM user_settings WHERE user_id = ?`, [user.id], (err4, settings) => {
          if (settings) {
            console.log('   Settings:', JSON.stringify(settings, null, 2));
          } else {
            console.log('   ❌ No settings found for this user');
          }
          db.close();
        });
      } else {
        console.log('\n⚠️ No user_settings table found');
        console.log('\n💡 SMS settings should be stored in the users table but columns are missing!');
        console.log('   Expected columns: auto_sms_enabled, sms_template');
        db.close();
      }
    });
  });
});
