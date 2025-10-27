const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');
const db = new sqlite3.Database(dbPath);

const email = 'mirchev92@gmail.com';

console.log('\n🔍 Checking user data for:', email);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check users table
db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
  if (err) {
    console.error('❌ Error:', err.message);
    db.close();
    return;
  }

  if (!user) {
    console.log('❌ User not found');
    db.close();
    return;
  }

  console.log('👤 USER TABLE:');
  console.log('   ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   First Name:', user.first_name);
  console.log('   Last Name:', user.last_name);
  console.log('   Role:', user.role);
  console.log('   Phone:', user.phone_number);

  // Check service provider profile
  db.get(`SELECT * FROM service_provider_profiles WHERE user_id = ?`, [user.id], (err2, profile) => {
    if (err2) {
      console.error('❌ Error:', err2.message);
      db.close();
      return;
    }

    console.log('\n🏢 SERVICE PROVIDER PROFILE:');
    if (profile) {
      console.log('   Business Name:', profile.business_name);
      console.log('   Service Category:', profile.service_category);
      console.log('   Description:', profile.description);
      console.log('   City:', profile.city);
    } else {
      console.log('   ❌ No profile found');
    }

    // Check chat tokens
    db.all(`SELECT * FROM chat_tokens WHERE user_id = ?`, [user.id], (err3, tokens) => {
      console.log('\n🎫 CHAT TOKENS:');
      if (tokens && tokens.length > 0) {
        tokens.forEach((token, i) => {
          console.log(`   Token ${i + 1}:`);
          console.log('      SP Identifier:', token.sp_identifier);
          console.log('      Token:', token.token);
          console.log('      Used:', token.is_used);
          console.log('      Expires:', token.expires_at);
        });
      } else {
        console.log('   ❌ No tokens found');
      }

      // Check conversations
      db.all(`
        SELECT * FROM marketplace_conversations 
        WHERE provider_id = ? OR customer_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `, [user.id, user.id], (err4, convs) => {
        console.log('\n💬 RECENT CONVERSATIONS:');
        if (convs && convs.length > 0) {
          convs.forEach((conv, i) => {
            console.log(`   Conversation ${i + 1}:`);
            console.log('      ID:', conv.id);
            console.log('      Customer Name:', conv.customer_name);
            console.log('      Provider ID:', conv.provider_id);
            console.log('      Customer ID:', conv.customer_id);
            console.log('      Status:', conv.status);
          });
        } else {
          console.log('   ❌ No conversations found');
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        db.close();
      });
    });
  });
});
