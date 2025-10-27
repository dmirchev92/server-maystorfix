const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔍 Checking token usage status...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to SQLite database');
});

// Check the specific token that should have been used
const tokenToCheck = '028W42IV';

db.get(`
  SELECT 
    token,
    user_id,
    sp_identifier,
    is_used,
    used_at,
    conversation_id,
    expires_at,
    created_at
  FROM chat_tokens
  WHERE token = ?
`, [tokenToCheck], (err, row) => {
  if (err) {
    console.error('❌ Error querying token:', err.message);
    return;
  }
  
  if (!row) {
    console.log(`❌ Token ${tokenToCheck} not found in database`);
  } else {
    console.log(`\n📊 Token ${tokenToCheck} status:`);
    console.log(`   Is Used: ${row.is_used ? 'YES' : 'NO'}`);
    console.log(`   Used At: ${row.used_at || 'Never'}`);
    console.log(`   Conversation ID: ${row.conversation_id || 'None'}`);
    console.log(`   User ID: ${row.user_id}`);
    console.log(`   SP Identifier: ${row.sp_identifier}`);
    console.log(`   Created: ${row.created_at}`);
    console.log(`   Expires: ${row.expires_at}`);
    
    if (row.is_used === 0) {
      console.log('\n❌ PROBLEM: Token was NOT marked as used!');
      console.log('This means the token validation endpoint was never called.');
      console.log('\n🔍 Possible causes:');
      console.log('1. Frontend is not calling the validation API');
      console.log('2. Token validation endpoint has an error');
      console.log('3. Frontend is using cached/session data instead of validating');
    } else {
      console.log('\n✅ Token was properly marked as used');
      console.log('Now checking if new token was generated...');
      
      // Check for newer tokens for the same user/SP
      db.all(`
        SELECT token, created_at, is_used 
        FROM chat_tokens 
        WHERE user_id = ? AND sp_identifier = ? 
        ORDER BY created_at DESC
      `, [row.user_id, row.sp_identifier], (err, tokens) => {
        if (err) {
          console.error('❌ Error checking for new tokens:', err.message);
        } else {
          console.log(`\n📋 All tokens for user ${row.user_id}:`);
          tokens.forEach((token, index) => {
            console.log(`${index + 1}. ${token.token} (used: ${token.is_used ? 'YES' : 'NO'}) - ${token.created_at}`);
          });
        }
        db.close();
      });
    }
  }
  
  if (!row || row.is_used === 0) {
    db.close();
  }
});
