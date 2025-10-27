const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔍 Getting current tokens from database...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to SQLite database');
});

// Get all current unused tokens
db.all(`
  SELECT 
    token,
    user_id,
    sp_identifier,
    expires_at,
    created_at
  FROM chat_tokens
  WHERE is_used = 0 
    AND expires_at > datetime('now')
  ORDER BY created_at DESC
`, (err, rows) => {
  if (err) {
    console.error('❌ Error querying tokens:', err.message);
    return;
  }
  
  console.log(`\n📊 Found ${rows.length} unused tokens:`);
  
  if (rows.length === 0) {
    console.log('❌ No unused tokens found. You may need to initialize the system first.');
  } else {
    rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Token: ${row.token}`);
      console.log(`   User ID: ${row.user_id}`);
      console.log(`   SP Identifier: ${row.sp_identifier}`);
      console.log(`   Chat URL: http://192.168.0.129:3002/u/${row.sp_identifier}/c/${row.token}`);
      console.log(`   Expires: ${row.expires_at}`);
      console.log(`   Created: ${row.created_at}`);
    });
    
    console.log(`\n🧪 To test token lifecycle:`);
    console.log(`1. Copy one of the Chat URLs above`);
    console.log(`2. Open it in browser`);
    console.log(`3. Run this script again to see if a new token was generated`);
  }
  
  db.close();
});
