const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔍 Debugging token validation...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to SQLite database');
});

// Monitor token changes in real-time
console.log('\n📊 Current token status:');

const checkTokens = () => {
  db.all(`
    SELECT 
      token,
      user_id,
      sp_identifier,
      is_used,
      used_at,
      conversation_id,
      created_at
    FROM chat_tokens
    WHERE sp_identifier = 'NoT_'
    ORDER BY created_at DESC
    LIMIT 5
  `, (err, rows) => {
    if (err) {
      console.error('❌ Error querying tokens:', err.message);
      return;
    }
    
    console.log(`\n⏰ ${new Date().toLocaleTimeString()} - Token Status:`);
    
    if (rows.length === 0) {
      console.log('❌ No tokens found for SP identifier NoT_');
    } else {
      rows.forEach((row, index) => {
        const status = row.is_used ? '🔴 USED' : '🟢 UNUSED';
        console.log(`${index + 1}. ${row.token} - ${status}`);
        console.log(`   Created: ${row.created_at}`);
        console.log(`   Used At: ${row.used_at || 'Never'}`);
        console.log(`   Conversation: ${row.conversation_id || 'None'}`);
        console.log('');
      });
    }
  });
};

// Check tokens every 5 seconds
checkTokens();
const interval = setInterval(checkTokens, 5000);

console.log('\n🧪 Instructions:');
console.log('1. Keep this script running');
console.log('2. Open the chat URL in browser: http://192.168.0.129:3002/u/NoT_/c/[TOKEN]');
console.log('3. Watch for token status changes');
console.log('4. Press Ctrl+C to stop monitoring');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping token monitoring...');
  clearInterval(interval);
  db.close();
  process.exit(0);
});
