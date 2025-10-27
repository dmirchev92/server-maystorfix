const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('🗑️ Clearing all chat data from database...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to SQLite database');
});

// Clear all chat-related tables
const clearTables = [
  'DELETE FROM chat_sessions',
  'DELETE FROM chat_tokens', 
  'DELETE FROM conversations',
  'DELETE FROM messages',
  'DELETE FROM service_provider_identifiers'
];

let completed = 0;
const total = clearTables.length;

clearTables.forEach((query, index) => {
  const tableName = query.split(' FROM ')[1];
  
  db.run(query, function(err) {
    if (err) {
      console.error(`❌ Error clearing ${tableName}:`, err.message);
    } else {
      console.log(`✅ Cleared ${tableName} - ${this.changes} rows deleted`);
    }
    
    completed++;
    if (completed === total) {
      console.log('\n🎉 All chat data cleared successfully!');
      console.log('📊 Summary:');
      console.log('- Chat sessions: cleared');
      console.log('- Chat tokens: cleared'); 
      console.log('- Conversations: cleared');
      console.log('- Messages: cleared');
      console.log('- Service provider identifiers: cleared');
      
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err.message);
        } else {
          console.log('✅ Database connection closed');
          console.log('\n🚀 Ready for fresh start!');
        }
      });
    }
  });
});
