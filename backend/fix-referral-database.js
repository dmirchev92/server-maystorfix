const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use the correct database path that matches SQLiteDatabase.ts
const dbPath = path.join(process.cwd(), 'data', 'servicetext_pro.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Setting up referrals in correct database:', dbPath);

db.serialize(() => {
  // First check if users exist
  db.all("SELECT id, email FROM users WHERE email IN ('damirchev92@gmail.com', 'gay@abv.bg')", (err, users) => {
    if (err) {
      console.error('❌ Error checking users:', err);
      return;
    }
    
    console.log(`📋 Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`   ${user.email}: ${user.id}`);
    });
    
    if (users.length < 2) {
      console.log('❌ Need both users to create referral relationship');
      db.close();
      return;
    }
    
    const referrer = users.find(u => u.email === 'damirchev92@gmail.com');
    const referred = users.find(u => u.email === 'gay@abv.bg');
    
    // Create referral tables
    db.run(`
      CREATE TABLE IF NOT EXISTS sp_referral_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        referral_code TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sp_referrals (
        id TEXT PRIMARY KEY,
        referrer_user_id TEXT NOT NULL,
        referred_user_id TEXT NOT NULL,
        referral_code TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referrer_user_id) REFERENCES users(id),
        FOREIGN KEY (referred_user_id) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS referral_clicks (
        id TEXT PRIMARY KEY,
        referral_id TEXT NOT NULL,
        customer_ip TEXT,
        customer_user_agent TEXT,
        is_valid INTEGER DEFAULT 1,
        month_year TEXT,
        clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referral_id) REFERENCES sp_referrals(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS referral_rewards (
        id TEXT PRIMARY KEY,
        referral_id TEXT NOT NULL,
        reward_type TEXT NOT NULL,
        reward_value REAL NOT NULL,
        clicks_milestone INTEGER NOT NULL,
        awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referral_id) REFERENCES sp_referrals(id)
      )
    `);

    // Create referral code for referrer
    const referrerCode = '4106CC30';
    db.run(
      `INSERT OR REPLACE INTO sp_referral_codes (id, user_id, referral_code) 
       VALUES (?, ?, ?)`,
      ['code_' + Date.now(), referrer.id, referrerCode]
    );

    // Create referral relationship
    const referralId = 'referral_' + Date.now();
    db.run(
      `INSERT OR REPLACE INTO sp_referrals (id, referrer_user_id, referred_user_id, referral_code, status) 
       VALUES (?, ?, ?, ?, 'active')`,
      [referralId, referrer.id, referred.id, referrerCode],
      function(err) {
        if (err) {
          console.error('❌ Error creating referral:', err);
        } else {
          console.log('✅ Created referral setup in correct database');
          console.log(`   Referral ID: ${referralId}`);
          console.log(`   Referrer: ${referrer.email} (${referrer.id})`);
          console.log(`   Referred: ${referred.email} (${referred.id})`);
          console.log(`   Code: ${referrerCode}`);
        }
        db.close();
      }
    );
  });
});
