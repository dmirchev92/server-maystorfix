const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'servicetext.db');
const db = new sqlite3.Database(dbPath);

// First create the referral tables if they don't exist
db.serialize(() => {
  // Create referral codes table
  db.run(`
    CREATE TABLE IF NOT EXISTS sp_referral_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      referral_code TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create referrals table
  db.run(`
    CREATE TABLE IF NOT EXISTS sp_referrals (
      id TEXT PRIMARY KEY,
      referrer_user_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrer_user_id) REFERENCES users(id),
      FOREIGN KEY (referred_user_id) REFERENCES users(id)
    )
  `);

  // Create referral clicks table
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

  // Create referral rewards table
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
  const referrerUserId = 'a89e2019-d5a1-4f64-8872-95c360bcbd8f';
  
  db.run(
    `INSERT OR REPLACE INTO sp_referral_codes (id, user_id, referral_code) 
     VALUES (?, ?, ?)`,
    ['code_' + Date.now(), referrerUserId, referrerCode]
  );

  // Create test referral relationship
  const referralId = 'test_referral_' + Date.now();
  const referredUserId = '5621d96e-0924-4c37-985f-2dcf57782012';

  db.run(
    `INSERT OR REPLACE INTO sp_referrals (id, referrer_user_id, referred_user_id, status) 
     VALUES (?, ?, ?, 'active')`,
    [referralId, referrerUserId, referredUserId],
    function(err) {
      if (err) {
        console.error('❌ Error creating referral:', err);
      } else {
        console.log('✅ Created referral tables and test relationship');
        console.log(`   Referral ID: ${referralId}`);
        console.log(`   Referrer: ${referrerUserId} (code: ${referrerCode})`);
        console.log(`   Referred: ${referredUserId}`);
      }
      db.close();
    }
  );
});
