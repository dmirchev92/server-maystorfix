const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');
const db = new sqlite3.Database(dbPath);

const deviceId = 'device_1759955532086_s15hkl2ef';
const realUserId = '8ac388d9-09d7-41ea-b97b-8af0382185eb';

console.log('\n🔧 Fixing chat tokens...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Update chat_tokens
db.run(`UPDATE chat_tokens SET user_id = ? WHERE user_id = ?`, [realUserId, deviceId], function(err) {
  if (err) {
    console.error('❌ Error updating chat_tokens:', err.message);
    db.close();
    return;
  }
  console.log('✅ Updated', this.changes, 'chat_tokens');

  // Update marketplace_conversations
  db.run(`UPDATE marketplace_conversations SET provider_id = ? WHERE provider_id = ?`, [realUserId, deviceId], function(err2) {
    if (err2) {
      console.error('❌ Error updating conversations:', err2.message);
      db.close();
      return;
    }
    console.log('✅ Updated', this.changes, 'marketplace_conversations');

    // Verify the fix
    db.get(`SELECT * FROM chat_tokens WHERE sp_identifier = 'C2I_' LIMIT 1`, (err3, token) => {
      if (token) {
        console.log('\n📋 Verified chat token:');
        console.log('   User ID:', token.user_id);
        console.log('   SP Identifier:', token.sp_identifier);
      }

      db.get(`SELECT id, provider_id, customer_name FROM marketplace_conversations WHERE id = 'c41c0424-2295-47a9-bf98-8b21d6e05190'`, (err4, conv) => {
        if (conv) {
          console.log('\n💬 Verified conversation:');
          console.log('   Provider ID:', conv.provider_id);
          console.log('   Customer:', conv.customer_name);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Fix complete! Refresh the chat page to see changes.\n');
        db.close();
      });
    });
  });
});
