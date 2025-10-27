const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🔍 Checking database contents...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to SQLite database');
});

// Check all chat-related tables
const checkQueries = [
  { name: 'conversations', query: 'SELECT COUNT(*) as count FROM conversations' },
  { name: 'messages', query: 'SELECT COUNT(*) as count FROM messages' },
  { name: 'chat_sessions', query: 'SELECT COUNT(*) as count FROM chat_sessions' },
  { name: 'chat_tokens', query: 'SELECT COUNT(*) as count FROM chat_tokens' },
  { name: 'service_provider_identifiers', query: 'SELECT COUNT(*) as count FROM service_provider_identifiers' }
];

let completed = 0;
const total = checkQueries.length;

checkQueries.forEach(({ name, query }) => {
  db.get(query, (err, row) => {
    if (err) {
      console.error(`❌ Error checking ${name}:`, err.message);
    } else {
      console.log(`📊 ${name}: ${row.count} rows`);
    }
    
    completed++;
    if (completed === total) {
      console.log('\n🔍 Database check complete');
      
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err.message);
        } else {
          console.log('✅ Database connection closed');
        }
      });
    }
  });
});
