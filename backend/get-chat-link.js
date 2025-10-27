const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');
const db = new sqlite3.Database(dbPath);

// Get a service provider and their chat link
db.get(`
  SELECT 
    ct.sp_identifier,
    ct.token,
    ct.is_used,
    ct.expires_at,
    u.id as user_id,
    COALESCE(p.business_name, u.first_name || ' ' || u.last_name) as provider_name
  FROM chat_tokens ct
  JOIN users u ON ct.user_id = u.id
  LEFT JOIN service_provider_profiles p ON u.id = p.user_id
  WHERE ct.is_used = 0 
    AND datetime(ct.expires_at) > datetime('now')
  ORDER BY ct.created_at DESC
  LIMIT 1
`, (err, row) => {
  if (err) {
    console.error('❌ Error:', err.message);
    db.close();
    return;
  }

  if (!row) {
    console.log('❌ No unused tokens found. Generating one...');
    
    // Get a service provider user
    db.get(`
      SELECT u.id, COALESCE(p.business_name, u.first_name || ' ' || u.last_name) as provider_name
      FROM users u
      LEFT JOIN service_provider_profiles p ON u.id = p.user_id
      WHERE u.role = 'service_provider'
      LIMIT 1
    `, (err2, user) => {
      if (err2 || !user) {
        console.error('❌ Error finding service provider:', err2?.message);
        db.close();
        return;
      }

      console.log('\n📋 Service Provider found:', user.provider_name);
      console.log('🆔 User ID:', user.id);
      console.log('\n⚠️  No active tokens. Please use the referrals page to generate one.');
      console.log('   Or call: POST http://192.168.0.129:3000/api/v1/chat/tokens/initialize');
      db.close();
    });
    return;
  }

  const chatUrl = `http://192.168.0.129:3002/u/${row.sp_identifier}/c/${row.token}`;
  
  console.log('\n✅ Chat Link Found!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👤 Provider:', row.provider_name);
  console.log('🆔 User ID:', row.user_id);
  console.log('🔑 SP Identifier:', row.sp_identifier);
  console.log('🎫 Token:', row.token);
  console.log('⏰ Expires:', row.expires_at);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔗 CHAT LINK:');
  console.log(chatUrl);
  console.log('\n📱 Test it by opening this URL in your browser!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  db.close();
});
